-- M13 · S05 (auditoria de segurança): os números de uma projeção aprovada mudavam sem rastro.
-- Quem aprova podia regravar o resumo (total, pico, pessoa-mês) e a auditoria ignorava a coluna.
-- Agora a aprovada fica congelada inteira, resumo incluído e para todos os perfis: para aprovar
-- valores novos, volta-se a Em análise e aprova-se de novo (as duas mudanças ficam auditadas).
-- O cálculo autoritativo no servidor fica para depois (CLAUDE.md, M13).

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
  -- aprovar e mudar números no mesmo passo não vale: os números aprovados são os que estavam
  if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada'
     and (to_jsonb(new) - 'situacao' - 'atualizado_em')
         is distinct from (to_jsonb(old) - 'situacao' - 'atualizado_em') then
    raise exception 'Aprove sem mudar a projeção: grave as mudanças antes.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- auditoria: o resumo entra sempre que a linha é auditada (a aprovação guarda os números
-- aprovados). Só o recálculo do resumo ao abrir uma projeção não aprovada fica fora (decisão M10).
drop trigger auditoria on public.projecoes;
create trigger auditoria after insert or delete on public.projecoes
  for each row execute function public.auditar('projecoes', 'id', 'id');
create trigger auditoria_alteracao after update on public.projecoes
  for each row
  when (old.situacao = 'aprovada' or new.situacao = 'aprovada'
        or (to_jsonb(old) - 'resumo' - 'atualizado_em') is distinct from
           (to_jsonb(new) - 'resumo' - 'atualizado_em'))
  execute function public.auditar('projecoes', 'id', 'id');
