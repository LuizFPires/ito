-- M14 · S05 (auditoria de segurança): a aprovação passa a ser calculada no servidor. A Edge
-- Function `projecoes` refaz o cálculo com o mesmo motor da tela e chama aprovar_projecao (só a
-- chave de serviço executa). Cada aprovação fica guardada com os números, as entradas, os preços
-- e a versão do cálculo; aprovações antigas não se perdem quando a projeção volta a Em análise.

create table public.projecao_aprovacoes (
  id bigint generated always as identity primary key,
  projecao_id uuid references public.projecoes (id) on delete set null,
  aprovado_por uuid references auth.users (id) on delete set null,
  aprovado_em timestamptz not null default now(),
  resumo jsonb not null check (public.json_resumo(resumo)),
  entradas jsonb not null,
  precos jsonb not null,
  referencias jsonb not null default '[]',
  versao_calculo text not null check (length(versao_calculo) between 1 and 64)
);
create index projecao_aprovacoes_projecao on public.projecao_aprovacoes (projecao_id, aprovado_em desc);

alter table public.projecao_aprovacoes enable row level security;
create policy ler on public.projecao_aprovacoes for select to authenticated
  using ((select public.sou_ativo()));
-- privilégios padrão fechados (M13): só leitura, explícita
grant select on public.projecao_aprovacoes to authenticated;

-- histórico imutável, também para a chave de serviço (só as FKs limpam autor e projeção apagados)
create function public.aprovacao_imutavel()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'projecao_id' - 'aprovado_por') = (to_jsonb(old) - 'projecao_id' - 'aprovado_por')
     and (new.projecao_id is null or new.projecao_id = old.projecao_id)
     and (new.aprovado_por is null or new.aprovado_por = old.aprovado_por) then
    return new;
  end if;
  raise exception 'O histórico de aprovações não é alterado nem apagado.' using errcode = '42501';
end;
$$;
revoke all on function public.aprovacao_imutavel() from public, anon, authenticated;
create trigger imutavel before update or delete on public.projecao_aprovacoes
  for each row execute function public.aprovacao_imutavel();

-- só a Edge Function (chave de serviço) aprova, com o cálculo que ela fez
create function public.aprovar_projecao(p_autor uuid, p_id uuid, p_resumo jsonb,
                                        p_atualizado_em timestamptz, p_registro jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  atual public.projecoes;
  novo bigint;
begin
  if not exists (select 1 from public.usuarios u
                 where u.id = p_autor and u.ativo and public.regra('aprovar', u.perfil, u.admin)) then
    raise exception 'Só a controladoria, a diretoria ou um administrador aprova projeções.'
      using errcode = '42501';
  end if;
  if p_resumo is null or not public.json_resumo(p_resumo) or not (p_resumo ? 'total') then
    raise exception 'Resumo inválido.' using errcode = '22023';
  end if;
  select * into atual from public.projecoes where id = p_id for update;
  if not found then
    raise exception 'A projeção não existe. Atualize a página.' using errcode = 'P0002';
  end if;
  if atual.situacao = 'aprovada' then
    raise exception 'A projeção já está aprovada. Atualize a página.' using errcode = '22023';
  end if;
  if atual.atualizado_em is distinct from p_atualizado_em then
    raise exception 'A projeção mudou enquanto era calculada. Atualize a página e aprove de novo.'
      using errcode = '40001';
  end if;
  perform set_config('ito.autor', p_autor::text, true);
  perform set_config('ito.aprovando', p_id::text, true);
  update public.projecoes set situacao = 'aprovada', resumo = p_resumo where id = p_id;
  perform set_config('ito.aprovando', '', true);
  insert into public.projecao_aprovacoes
    (projecao_id, aprovado_por, resumo, entradas, precos, referencias, versao_calculo)
  values (p_id, p_autor, p_resumo, coalesce(p_registro -> 'entradas', '{}'),
          coalesce(p_registro -> 'precos', '{}'), coalesce(p_registro -> 'referencias', '[]'),
          coalesce(p_registro ->> 'versao_calculo', '?'))
  returning id into novo;
  return novo;
end;
$$;
revoke all on function public.aprovar_projecao(uuid, uuid, jsonb, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.aprovar_projecao(uuid, uuid, jsonb, timestamptz, jsonb) to service_role;

-- pela API do navegador não se aprova mais (nem com resumo): só desfazer e as outras situações
drop function public.definir_situacao(uuid, public.situacao_projecao, jsonb);
create function public.definir_situacao(p_id uuid, p_situacao public.situacao_projecao)
returns void language plpgsql security definer set search_path = '' as $$
declare
  atual public.situacao_projecao;
begin
  if p_situacao = 'aprovada' then
    raise exception 'Aprove pelo botão Aprovada da projeção: o cálculo é refeito no servidor.'
      using errcode = '42501';
  end if;
  select situacao into atual from public.projecoes where id = p_id for update;
  if not found then
    raise exception 'A projeção não existe. Atualize a página.' using errcode = 'P0002';
  end if;
  if atual = 'aprovada' then
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
revoke all on function public.definir_situacao(uuid, public.situacao_projecao) from public, anon;
grant execute on function public.definir_situacao(uuid, public.situacao_projecao) to authenticated;

-- gatilho: virar Aprovada só dentro de aprovar_projecao (UPDATE direto pela API é recusado)
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
  if old.situacao = 'aprovada' and new.situacao is distinct from 'aprovada'
     and not public.pode_aprovar() then
    raise exception 'Só a controladoria, a diretoria ou um administrador aprova ou desfaz a aprovação.'
      using errcode = '42501';
  end if;
  if old.situacao = 'aprovada' and new.situacao = 'aprovada'
     and (to_jsonb(new) - 'atualizado_em') is distinct from (to_jsonb(old) - 'atualizado_em') then
    raise exception 'Projeção aprovada não pode ser alterada. Duplique-a ou peça a quem aprova para voltá-la a Em análise.'
      using errcode = '42501';
  end if;
  if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada' then
    if coalesce(current_setting('ito.aprovando', true), '') <> new.id::text then
      raise exception 'Aprove pelo botão Aprovada da projeção: o cálculo é refeito no servidor.'
        using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'situacao' - 'atualizado_em' - 'resumo')
       is distinct from (to_jsonb(old) - 'situacao' - 'atualizado_em' - 'resumo') then
      raise exception 'Aprove sem mudar a projeção: grave as mudanças antes.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
