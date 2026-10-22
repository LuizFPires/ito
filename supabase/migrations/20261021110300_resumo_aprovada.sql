-- M7 — Revisão: o resumo (total, pico, custo da lista) de uma projeção aprovada só é regravado por
-- quem aprova (e pode editar: controladoria ou admin). Quem só projeta não muda os números que a
-- diretoria aprovou.

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
  if old.situacao = 'aprovada' and new.situacao = 'aprovada' then
    -- só o resumo (cache da lista) pode mudar numa aprovada, e só por quem aprova
    if (to_jsonb(new) - 'resumo' - 'atualizado_em') is distinct from (to_jsonb(old) - 'resumo' - 'atualizado_em') then
      raise exception 'Projeção aprovada não pode ser alterada. Duplique-a ou peça a quem aprova para voltá-la a Em análise.'
        using errcode = '42501';
    end if;
    if new.resumo is distinct from old.resumo and not public.pode_aprovar() then
      raise exception 'O resumo de uma projeção aprovada só é recalculado por quem aprova.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
