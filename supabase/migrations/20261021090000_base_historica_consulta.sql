-- M5 — Base histórica e detalhe da obra.
-- 1. Resumo da obra em cache (decisão M5): o que a lista de 1.000 obras mostra, calculado pelo motor
--    no navegador e gravado aqui; vale para a tabela vigente em `vigente` e a versão `versao`.
-- 2. Edição de premissas e ausências por quem carrega (DP/RH, controladoria, admin).

create table public.obra_resumo (
  obra_id text primary key references public.obras (id) on delete cascade,
  vigente integer not null,
  versao integer not null default 1,
  pico numeric(10, 2) not null default 0,
  pessoa_mes numeric(12, 2) not null default 0,
  he_por_pessoa numeric(10, 2) not null default 0,
  indireta_pct numeric(7, 4) not null default 0,
  custo_epoca numeric(16, 2) not null default 0,
  custo_atual numeric(16, 2) not null default 0,
  -- pessoa-mês total por mês (mini-histograma)
  histograma numeric(10, 2)[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
comment on table public.obra_resumo is
  'Cache do resumo da obra para a lista da base histórica (decisão M5). Recalculado ao gravar ou editar a obra e quando a tabela vigente muda.';

alter table public.obra_resumo enable row level security;
revoke all on table public.obra_resumo from anon, authenticated;
grant select on table public.obra_resumo to authenticated;
create policy ler on public.obra_resumo for select to authenticated using (true);

-- Quem atualiza o cache: quem carrega (edita a obra) e a controladoria (muda a tabela vigente).
create function public.gravar_resumos(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not (public.pode_carregar() or public.pode_editar_config()) then
    raise exception 'Só DP/RH, controladoria ou um administrador atualiza o resumo das obras.'
      using errcode = '42501';
  end if;
  insert into public.obra_resumo (obra_id, vigente, versao, pico, pessoa_mes, he_por_pessoa,
    indireta_pct, custo_epoca, custo_atual, histograma, atualizado_em)
  select x.obra_id, x.vigente, coalesce(x.versao, 1), x.pico, x.pessoa_mes, x.he_por_pessoa,
    x.indireta_pct, x.custo_epoca, x.custo_atual, coalesce(x.histograma, '{}'), now()
  from jsonb_populate_recordset(null::public.obra_resumo, coalesce(p, '[]')) x
  where exists (select 1 from public.obras o where o.id = x.obra_id)
  on conflict (obra_id) do update set
    vigente = excluded.vigente, versao = excluded.versao, pico = excluded.pico,
    pessoa_mes = excluded.pessoa_mes, he_por_pessoa = excluded.he_por_pessoa,
    indireta_pct = excluded.indireta_pct, custo_epoca = excluded.custo_epoca,
    custo_atual = excluded.custo_atual, histograma = excluded.histograma, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.gravar_resumos(jsonb) from public, anon;
grant execute on function public.gravar_resumos(jsonb) to authenticated;

-- 2. edição de premissas e ausências (colunas liberadas; o resto da obra continua só pela carga)
grant update (grat_premios_pct, transf_pct, funcoes_transferidas, risco_pct, lucro_pct,
  trib_lucro_pct, fora_da_sede, provisionar, adiantamento, adiantamento_pct, rotatividade_pct,
  he_mix_util, he_mix_sabado, he_mix_intervalo, he_mix_feriado) on public.obras to authenticated;
create policy editar on public.obras for update to authenticated
  using ((select public.pode_carregar())) with check ((select public.pode_carregar()));

grant update (absenteismo_pct, licenca_pessoa_dias, ferias_pessoa_dias, he_media)
  on public.competencias to authenticated;
create policy editar on public.competencias for update to authenticated
  using ((select public.pode_carregar())) with check ((select public.pode_carregar()));

do $$
declare
  t text;
begin
  foreach t in array array['obra_regime', 'obra_trocas_tabela', 'obra_feriados'] loop
    execute format('grant insert, delete on table public.%I to authenticated', t);
    execute format('create policy editar on public.%I for all to authenticated
      using ((select public.pode_carregar())) with check ((select public.pode_carregar()))', t);
  end loop;
end $$;
grant update (regime) on public.obra_regime to authenticated;
grant update (data_base, motivo) on public.obra_trocas_tabela to authenticated;
grant update (nome) on public.obra_feriados to authenticated;

-- Editar a obra invalida o resumo (versão 0 = recalcular).
create function public.resumo_desatualizado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.obra_resumo set versao = 0 where obra_id = coalesce(new.obra_id, old.obra_id);
  return null;
end;
$$;
revoke all on function public.resumo_desatualizado() from public, anon, authenticated;
create function public.resumo_desatualizado_obra()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.obra_resumo set versao = 0 where obra_id = new.id;
  return null;
end;
$$;
revoke all on function public.resumo_desatualizado_obra() from public, anon, authenticated;
create trigger resumo after update on public.obras
  for each row execute function public.resumo_desatualizado_obra();
create trigger resumo after insert or update or delete on public.competencias
  for each row execute function public.resumo_desatualizado();
create trigger resumo after insert or update or delete on public.obra_regime
  for each row execute function public.resumo_desatualizado();
create trigger resumo after insert or update or delete on public.obra_trocas_tabela
  for each row execute function public.resumo_desatualizado();
create trigger resumo after insert or update or delete on public.obra_feriados
  for each row execute function public.resumo_desatualizado();
