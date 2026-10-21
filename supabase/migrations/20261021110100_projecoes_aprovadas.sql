-- M7 — Integridade da aprovação e autoria (revisão de segurança):
-- 1. Projeção aprovada não é editada nem apagada (só o resumo pode ser recalculado). Para mudar,
--    duplique-a ou peça a quem aprova para voltá-la a "Em análise".
-- 2. Sair de "Aprovada" também exige quem aprova.
-- 3. Autor e data de criação vêm do banco (não do cliente).

create function public.projecao_aprovada_travada()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao = 'aprovada' then
      raise exception 'Projeção aprovada não pode ser apagada. Peça a quem aprova para voltá-la a Em análise.'
        using errcode = '42501';
    end if;
    return old;
  end if;
  -- só o resumo (cache da lista) e a própria situação podem mudar numa aprovada
  if old.situacao = 'aprovada' and new.situacao = 'aprovada'
     and (to_jsonb(new) - 'resumo' - 'atualizado_em') is distinct from (to_jsonb(old) - 'resumo' - 'atualizado_em') then
    raise exception 'Projeção aprovada não pode ser alterada. Duplique-a ou peça a quem aprova para voltá-la a Em análise.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.projecao_aprovada_travada() from public, anon, authenticated;
create trigger aprovada_travada before update or delete on public.projecoes
  for each row execute function public.projecao_aprovada_travada();

create function public.autoria_projecao()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.criado_por := auth.uid();
  new.criado_em := now();
  new.atualizado_em := now();
  new.situacao := 'rascunho';
  return new;
end;
$$;
revoke all on function public.autoria_projecao() from public, anon, authenticated;
create trigger autoria before insert on public.projecoes
  for each row execute function public.autoria_projecao();

create or replace function public.definir_situacao(p_id uuid, p_situacao public.situacao_projecao)
returns void language plpgsql security definer set search_path = '' as $$
declare
  atual public.situacao_projecao;
begin
  select situacao into atual from public.projecoes where id = p_id;
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
  update public.projecoes set situacao = p_situacao where id = p_id;
end;
$$;
