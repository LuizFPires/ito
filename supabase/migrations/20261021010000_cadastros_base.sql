-- M1 — Cadastros base: funções, rubricas, tabela da empresa por data-base, parâmetros e calendário.
-- Percentuais de 0 a 100 (como na interface); valores em R$ com 2 casas.
-- Edição (CLAUDE.md, decisões M1): controladoria e admin editam tudo; DP/RH edita funções e rubricas.

create type public.grupo_funcao as enum ('direta', 'indireta', 'adm');
create type public.vinculo as enum ('clt', 'estagio');
create type public.tipo_rubrica as enum ('provento', 'desconto', 'informativo');
create type public.componente_rubrica as enum (
  'sal', 'extras', 'he', 'dsr', 'faltas', 'resc', 'ferr', 'provpaga', 'compgps', 'nao', 'info'
);
create type public.grupo_encargo as enum ('soc', 'prov', 'nf');
create type public.modo_dias as enum ('calendario', 'fixo');

-- ── permissões ───────────────────────────────────────────────────────────────
create function public.pode_editar_config()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil = 'controladoria'
                   from public.usuarios u where u.id = auth.uid()), false);
$$;

create function public.pode_editar_cadastros()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil in ('controladoria', 'dp_rh')
                   from public.usuarios u where u.id = auth.uid()), false);
$$;

revoke all on function public.pode_editar_config() from public, anon;
revoke all on function public.pode_editar_cadastros() from public, anon;
grant execute on function public.pode_editar_config() to authenticated;
grant execute on function public.pode_editar_cadastros() to authenticated;

-- Quem alterou e quando (auditoria completa fica para o M10).
create function public.carimbar_alteracao()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;
revoke all on function public.carimbar_alteracao() from public, anon, authenticated;

-- ── funções padrão ───────────────────────────────────────────────────────────
create table public.funcoes (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,31}$'),
  nome text not null check (length(trim(nome)) > 0),
  grupo public.grupo_funcao not null,
  conta_pc text not null default '',
  escala_area boolean not null default false,
  vinculo public.vinculo not null default 'clt',
  cor text not null default 'i4',
  exame_adm numeric(12, 2) not null default 0 check (exame_adm >= 0),
  exame_per_anual numeric(12, 2) not null default 0 check (exame_per_anual >= 0),
  exame_dem numeric(12, 2) not null default 0 check (exame_dem >= 0),
  peric_pct numeric(7, 4) not null default 0 check (peric_pct between 0 and 100),
  insal_pct_sm numeric(7, 4) not null default 0 check (insal_pct_sm between 0 and 100),
  horas_noturnas_mes numeric(7, 2) not null default 0 check (horas_noturnas_mes >= 0),
  ferramentas_mes numeric(12, 2) not null default 0 check (ferramentas_mes >= 0),
  fator_he numeric(6, 3) not null default 1 check (fator_he >= 0),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
create unique index funcoes_nome_unico on public.funcoes (lower(nome));

comment on column public.funcoes.fator_he is 'Fator de HE da função sobre a média da obra (SPEC §4.3).';

-- Texto da folha → função padrão. Guardado em caixa alta, sem espaços nas pontas.
create table public.funcao_sinonimos (
  texto text primary key check (texto = upper(trim(texto)) and length(texto) > 0),
  funcao_id text not null references public.funcoes (id) on delete cascade on update cascade
);
create index funcao_sinonimos_funcao on public.funcao_sinonimos (funcao_id);

-- ── rubricas da folha ────────────────────────────────────────────────────────
create table public.rubricas (
  codigo integer primary key check (codigo > 0),
  nome text not null check (length(trim(nome)) > 0),
  tipo public.tipo_rubrica not null,
  componente public.componente_rubrica not null,
  base_provisoes boolean not null default false,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

-- ── benefícios (catálogo) ────────────────────────────────────────────────────
create table public.beneficios (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,31}$'),
  nome text not null,
  conta_pc text not null default '',
  -- alojamento e viagens: só para MO alojada / obra fora da sede (SPEC §4.4)
  so_fora_sede boolean not null default false,
  ordem integer not null default 0
);

-- ── tabela da empresa por data-base ──────────────────────────────────────────
create table public.datas_base (
  ano integer primary key check (ano between 2000 and 2100),
  a_revisar boolean not null default false,
  he_adicional_util numeric(7, 4) not null default 100,
  he_adicional_sabado numeric(7, 4) not null default 100,
  he_adicional_intervalo numeric(7, 4) not null default 50,
  he_adicional_feriado numeric(7, 4) not null default 100,
  divisor numeric(7, 2) not null default 220 check (divisor > 0),
  modo_dias public.modo_dias not null default 'calendario',
  sabado_trabalhado boolean not null default false,
  dias_fixos numeric(5, 2) not null default 22 check (dias_fixos > 0 and dias_fixos <= 31),
  dsr_fixo_pct numeric(7, 4) not null default 20 check (dsr_fixo_pct >= 0),
  vt_diaria_ref numeric(12, 2) not null default 0 check (vt_diaria_ref >= 0),
  fator_rescisao numeric(7, 4) not null default 0.9 check (fator_rescisao >= 0),
  salario_minimo numeric(12, 2) not null default 0 check (salario_minimo >= 0),
  adicional_noturno_pct numeric(7, 4) not null default 20,
  sf_teto numeric(12, 2) not null default 0,
  sf_cota numeric(12, 2) not null default 0,
  criado_de integer references public.datas_base (ano) on delete set null,
  reajuste_pct numeric(7, 4),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

create table public.data_base_salarios (
  ano integer not null references public.datas_base (ano) on delete cascade,
  funcao_id text not null references public.funcoes (id) on delete cascade on update cascade,
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (ano, funcao_id)
);

create table public.data_base_beneficios (
  ano integer not null references public.datas_base (ano) on delete cascade,
  beneficio_id text not null references public.beneficios (id) on delete cascade,
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (ano, beneficio_id)
);

create table public.data_base_encargos (
  ano integer not null references public.datas_base (ano) on delete cascade,
  id text not null check (id ~ '^[a-z][a-z0-9_]{0,31}$'),
  grupo public.grupo_encargo not null,
  nome text not null,
  base_calc_pct numeric(7, 4) not null default 100 check (base_calc_pct between 0 and 100),
  aliq_clt numeric(7, 4) not null default 0 check (aliq_clt between 0 and 100),
  aliq_sp numeric(7, 4) not null default 0 check (aliq_sp between 0 and 100),
  ordem integer not null default 0,
  primary key (ano, id)
);

-- ── parâmetros (uma linha) e feriados da empresa ─────────────────────────────
create table public.parametros (
  id boolean primary key default true check (id),
  data_base_vigente integer references public.datas_base (ano),
  carnaval boolean not null default false,
  corpus_christi boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

create table public.feriados_empresa (
  data date primary key,
  nome text not null check (length(trim(nome)) > 0)
);

-- ── carimbo de alteração ─────────────────────────────────────────────────────
create trigger carimbar before insert or update on public.funcoes
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.rubricas
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.datas_base
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.parametros
  for each row execute function public.carimbar_alteracao();

-- ── acesso ───────────────────────────────────────────────────────────────────
-- Todos os perfis leem; escrita conforme a decisão do M1. Anônimo não vê nada.
do $$
declare
  t text;
  cadastros text[] := array['funcoes', 'funcao_sinonimos', 'rubricas'];
  config text[] := array['beneficios', 'datas_base', 'data_base_salarios', 'data_base_beneficios',
                         'data_base_encargos', 'parametros', 'feriados_empresa'];
begin
  foreach t in array cadastros || config loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy ler on public.%I for select to authenticated using (true)', t);
  end loop;
  foreach t in array cadastros loop
    execute format('create policy editar on public.%I for all to authenticated
      using ((select public.pode_editar_cadastros())) with check ((select public.pode_editar_cadastros()))', t);
  end loop;
  foreach t in array config loop
    execute format('create policy editar on public.%I for all to authenticated
      using ((select public.pode_editar_config())) with check ((select public.pode_editar_config()))', t);
  end loop;
end $$;

-- Carimbo não é editável pela API.
revoke update (atualizado_em, atualizado_por) on public.funcoes, public.rubricas, public.datas_base,
  public.parametros from authenticated;

-- ── nova data-base: cópia de outra + reajuste em salários e benefícios ───────
create function public.criar_data_base(p_ano integer, p_origem integer, p_reajuste_pct numeric)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fator numeric := 1 + coalesce(p_reajuste_pct, 0) / 100;
begin
  if not public.pode_editar_config() then
    raise exception 'Só a controladoria ou um administrador cria data-base.' using errcode = '42501';
  end if;
  if p_reajuste_pct is not null and (p_reajuste_pct < -50 or p_reajuste_pct > 100) then
    raise exception 'Informe um reajuste entre -50%% e 100%%.' using errcode = '22023';
  end if;
  if exists (select 1 from public.datas_base where ano = p_ano) then
    raise exception 'A data-base % já existe. Escolha outro ano.', p_ano using errcode = '23505';
  end if;
  if not exists (select 1 from public.datas_base where ano = p_origem) then
    raise exception 'A data-base de origem % não existe.', p_origem using errcode = '23503';
  end if;

  insert into public.datas_base (
    ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo,
    he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct,
    vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota,
    criado_de, reajuste_pct)
  select p_ano, true, he_adicional_util, he_adicional_sabado, he_adicional_intervalo,
    he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct,
    vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota,
    p_origem, coalesce(p_reajuste_pct, 0)
  from public.datas_base where ano = p_origem;

  insert into public.data_base_salarios (ano, funcao_id, valor)
  select p_ano, funcao_id, round(valor * fator, 2) from public.data_base_salarios where ano = p_origem;

  insert into public.data_base_beneficios (ano, beneficio_id, valor)
  select p_ano, beneficio_id, round(valor * fator, 2) from public.data_base_beneficios where ano = p_origem;

  insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem)
  select p_ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem
  from public.data_base_encargos where ano = p_origem;

  return p_ano;
end;
$$;

revoke all on function public.criar_data_base(integer, integer, numeric) from public, anon;
grant execute on function public.criar_data_base(integer, integer, numeric) to authenticated;
