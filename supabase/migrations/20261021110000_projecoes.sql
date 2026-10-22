-- M7 — Projeções (SPEC §1.3). Guarda as entradas; o motor recalcula na tela. Um resumo vai junto
-- para a lista. Quem edita (decisão M7): planejamento, engenharia, controladoria e admin.
-- Aprovar: controladoria, diretoria e admin.

create function public.pode_projetar()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil in ('planejamento', 'engenharia', 'controladoria')
                   from public.usuarios u where u.id = auth.uid()), false);
$$;
create function public.pode_aprovar()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil in ('controladoria', 'diretoria')
                   from public.usuarios u where u.id = auth.uid()), false);
$$;
revoke all on function public.pode_projetar() from public, anon;
revoke all on function public.pode_aprovar() from public, anon;
grant execute on function public.pode_projetar() to authenticated;
grant execute on function public.pode_aprovar() to authenticated;

create type public.situacao_projecao as enum ('rascunho', 'em_analise', 'aprovada');

create table public.projecoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cliente text not null default '',
  tipologia text not null default '',
  cidade_id text references public.cidades (id) on delete restrict,
  -- de onde vem quem viaja todo dia (VT da origem "diária")
  cidade_origem_id text references public.cidades (id) on delete restrict,
  inicio date not null check (extract(day from inicio) = 1),
  prazo_meses integer not null check (prazo_meses between 1 and 120),
  area_m2 numeric(12, 2) not null check (area_m2 > 0),
  -- obras de referência (as que sumirem da base são ignoradas no cálculo)
  referencias text[] not null default '{}',
  estatistica text not null default 'media' check (estatistica in ('media', 'mediana')),
  -- {funcao: -30..30}
  ajustes jsonb not null default '{}'::jsonb,
  -- {funcao: [pessoas por mês]} ou nulo
  quantidades_manuais jsonb,
  he_media numeric(10, 4) check (he_media >= 0),
  absenteismo_pct numeric(7, 4) check (absenteismo_pct between 0 and 100),
  rotatividade_pct numeric(7, 4) check (rotatividade_pct between 0 and 100),
  licenca_por_pm numeric(10, 4) check (licenca_por_pm >= 0),
  ferias_por_pm numeric(10, 4) check (ferias_por_pm >= 0),
  -- {util, sabado, intervalo, feriado} somando 100 ou nulo (média das referências)
  he_mix jsonb,
  premissas jsonb not null default '{}'::jsonb,
  -- {funcao: clt|sp}
  regime jsonb not null default '{}'::jsonb,
  -- {funcao: local|diaria|aloj}
  origem jsonb not null default '{}'::jsonb,
  -- reajuste informado (nulo = automático pela CCT); pct 0 = sem reajuste
  reajuste_mes integer check (reajuste_mes >= 1),
  reajuste_pct numeric(7, 4) check (reajuste_pct between -50 and 100),
  situacao public.situacao_projecao not null default 'rascunho',
  -- resumo para a lista: {total, pico, pessoa_mes, vigente}
  resumo jsonb not null default '{}'::jsonb,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((reajuste_mes is null) = (reajuste_pct is null)),
  check (reajuste_mes is null or reajuste_mes < prazo_meses)
);
create index projecoes_situacao on public.projecoes (situacao);
create index projecoes_nome on public.projecoes (lower(nome));
comment on table public.projecoes is 'Projeção de MO de obra futura (SPEC §1.3). Entradas; o motor calcula.';

create function public.carimbar_projecao()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function public.carimbar_projecao() from public, anon, authenticated;
create trigger carimbar before update on public.projecoes
  for each row execute function public.carimbar_projecao();

alter table public.projecoes enable row level security;
revoke all on table public.projecoes from anon, authenticated;
grant select, insert, delete on table public.projecoes to authenticated;
-- tudo menos situação (que muda por definir_situacao), carimbo e autoria
grant update (nome, cliente, tipologia, cidade_id, cidade_origem_id, inicio, prazo_meses, area_m2,
  referencias, estatistica, ajustes, quantidades_manuais, he_media, absenteismo_pct,
  rotatividade_pct, licenca_por_pm, ferias_por_pm, he_mix, premissas, regime, origem,
  reajuste_mes, reajuste_pct, resumo) on public.projecoes to authenticated;
create policy ler on public.projecoes for select to authenticated using (true);
create policy criar on public.projecoes for insert to authenticated
  with check ((select public.pode_projetar()) and situacao = 'rascunho');
create policy editar on public.projecoes for update to authenticated
  using ((select public.pode_projetar())) with check ((select public.pode_projetar()));
create policy apagar on public.projecoes for delete to authenticated
  using ((select public.pode_projetar()));

/** Situação: quem edita põe em rascunho ou em análise; aprovar é da controladoria/diretoria. */
create function public.definir_situacao(p_id uuid, p_situacao public.situacao_projecao)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_situacao = 'aprovada' then
    if not public.pode_aprovar() then
      raise exception 'Só a controladoria, a diretoria ou um administrador aprova projeções.'
        using errcode = '42501';
    end if;
  elsif not (public.pode_projetar() or public.pode_aprovar()) then
    raise exception 'Você não pode mudar a situação desta projeção. Peça ao planejamento.'
      using errcode = '42501';
  end if;
  update public.projecoes set situacao = p_situacao where id = p_id;
  if not found then
    raise exception 'A projeção não existe. Atualize a página.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.definir_situacao(uuid, public.situacao_projecao) from public, anon;
grant execute on function public.definir_situacao(uuid, public.situacao_projecao) to authenticated;
