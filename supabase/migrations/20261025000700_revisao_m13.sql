-- Revisão do M13.
-- 1. Os números congelados na aprovação eram o último resumo que alguém gravou (sem auditoria
--    enquanto a projeção não estava aprovada): podia ser velho ou forjado pela API. Agora quem
--    aprova envia o resumo que está vendo, e ele é gravado junto com a aprovação (auditado).
-- 2. Grants explícitos das funções que CHECKs e políticas chamam: com os privilégios padrão
--    fechados (20261025000600), uma recriação futura não pode deixá-las sem EXECUTE.

drop function public.definir_situacao(uuid, public.situacao_projecao);
create function public.definir_situacao(p_id uuid, p_situacao public.situacao_projecao,
                                        p_resumo jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  atual public.situacao_projecao;
begin
  select situacao into atual from public.projecoes where id = p_id for update;
  if not found then
    raise exception 'A projeção não existe. Atualize a página.' using errcode = 'P0002';
  end if;
  if p_situacao = 'aprovada' or atual = 'aprovada' then
    if not public.pode_aprovar() then
      raise exception 'Só a controladoria, a diretoria ou um administrador aprova ou desfaz a aprovação.'
        using errcode = '42501';
    end if;
  elsif not (public.pode_projetar() or public.pode_aprovar()) then
    raise exception 'Você não pode mudar a situação desta projeção. Peça ao planejamento.'
      using errcode = '42501';
  end if;
  if p_situacao = 'aprovada' and atual <> 'aprovada' then
    if p_resumo is null or not public.json_resumo(p_resumo) or not (p_resumo ? 'total') then
      raise exception 'Espere o cálculo terminar para aprovar: os números aprovados são os da tela.'
        using errcode = '22023';
    end if;
    -- o gatilho da aprovada aceita o resumo novo só neste passo
    perform set_config('ito.aprovando', p_id::text, true);
    update public.projecoes set situacao = p_situacao, resumo = p_resumo where id = p_id;
    perform set_config('ito.aprovando', '', true);
  else
    update public.projecoes set situacao = p_situacao where id = p_id;
  end if;
end;
$$;
revoke all on function public.definir_situacao(uuid, public.situacao_projecao, jsonb) from public, anon;
grant execute on function public.definir_situacao(uuid, public.situacao_projecao, jsonb) to authenticated;

create or replace function public.projecao_aprovada_travada()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao = 'aprovada' then
      raise exception 'Projeção aprovada não pode ser apagada. Peça a quem aprova para voltá-la a Em análise.'
        using errcode = '42501';
    end if;
    return old;
  end if;
  if old.situacao is distinct from new.situacao
     and (old.situacao = 'aprovada' or new.situacao = 'aprovada')
     and not public.pode_aprovar() then
    raise exception 'Só a controladoria, a diretoria ou um administrador aprova ou desfaz a aprovação.'
      using errcode = '42501';
  end if;
  if old.situacao = 'aprovada' and new.situacao = 'aprovada'
     and (to_jsonb(new) - 'atualizado_em') is distinct from (to_jsonb(old) - 'atualizado_em') then
    raise exception 'Projeção aprovada não pode ser alterada. Duplique-a ou peça a quem aprova para voltá-la a Em análise.'
      using errcode = '42501';
  end if;
  -- aprovar e mudar a projeção no mesmo passo não vale; só o resumo, e só por definir_situacao
  if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada'
     and (to_jsonb(new) - 'situacao' - 'atualizado_em' - 'resumo')
         is distinct from (to_jsonb(old) - 'situacao' - 'atualizado_em' - 'resumo') then
    raise exception 'Aprove sem mudar a projeção: grave as mudanças antes.' using errcode = '42501';
  end if;
  if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada'
     and new.resumo is distinct from old.resumo
     and coalesce(current_setting('ito.aprovando', true), '') <> new.id::text then
    raise exception 'Aprove pela tela da projeção: os números aprovados são os do cálculo.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

grant execute on function public.json_numeros(jsonb, numeric, numeric, integer, text[]) to authenticated;
grant execute on function public.json_opcoes(jsonb, text[], integer) to authenticated;
grant execute on function public.json_quantidades(jsonb) to authenticated;
grant execute on function public.json_premissas(jsonb) to authenticated;
grant execute on function public.json_resumo(jsonb) to authenticated;
grant execute on function public.exigir_lote(jsonb, text, bigint) to authenticated;
