-- M4 — Base histórica: obras carregadas da folha (SPEC §1.2).
-- Trabalhador só por matrícula, nunca nome, CPF ou endereço (CLAUDE.md, regra 2).
-- Quem carrega (decisão M4): DP/RH, controladoria e admin. Todos os perfis leem.
-- A escrita passa só por `gravar_carga` e `excluir_obra` (uma transação, pendências bloqueantes
-- recusadas no banco); a API não grava direto nas tabelas.

create function public.pode_carregar()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil in ('controladoria', 'dp_rh')
                   from public.usuarios u where u.id = auth.uid()), false);
$$;
revoke all on function public.pode_carregar() from public, anon;
grant execute on function public.pode_carregar() to authenticated;

-- ── HE por tipo: qual rubrica de HE é de qual tipo (SPEC §4.3, §7) ───────────
alter table public.rubricas add column tipo_he text
  check (tipo_he in ('util', 'sabado', 'intervalo', 'feriado'));
alter table public.rubricas add constraint rubricas_tipo_he_so_he
  check (tipo_he is null or componente = 'he');
update public.rubricas set tipo_he = case codigo
  when 200 then 'util' when 201 then 'sabado' when 205 then 'intervalo' when 210 then 'feriado' end
  where codigo in (200, 201, 205, 210);
grant update (tipo_he) on public.rubricas to authenticated;
comment on column public.rubricas.tipo_he is
  'Tipo de HE da rubrica (a referência são horas). Só para componente he; nulo = HE sem tipo, conta como dias úteis.';

-- ── justificativas da apropriação × ERP (lista controlada, SPEC §6.2) ───────
create table public.justificativas_erp (
  texto text primary key check (length(trim(texto)) > 0),
  ordem integer not null default 0
);
insert into public.justificativas_erp (texto, ordem) values
  ('Benefícios a lançar no mês seguinte', 1),
  ('Arredondamento', 2),
  ('Lançamento em outra obra', 3),
  ('Rescisão paga em outra competência', 4),
  ('Em análise', 5);

-- ── obra ─────────────────────────────────────────────────────────────────────
create type public.regime as enum ('clt', 'sp');
create type public.tipo_realocacao as enum ('cedida', 'recebida');

create table public.obras (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,47}$'),
  nome text not null check (length(trim(nome)) > 0),
  cliente text not null default '',
  tipologia text not null default '',
  cidade_id text references public.cidades (id) on delete restrict,
  area_m2 numeric(12, 2) not null check (area_m2 > 0),
  -- primeiro dia do mês de início; a obra tem `meses` competências (mes_idx 0..meses−1)
  inicio date not null check (extract(day from inicio) = 1),
  meses integer not null check (meses between 1 and 120),
  data_base integer not null references public.datas_base (ano) on delete restrict,
  fora_da_sede boolean not null default false,
  grat_premios_pct numeric(7, 4) not null default 3 check (grat_premios_pct between 0 and 100),
  transf_pct numeric(7, 4) not null default 25 check (transf_pct between 0 and 100),
  funcoes_transferidas text[] not null default '{}',
  risco_pct numeric(7, 4) not null default 0 check (risco_pct between 0 and 100),
  lucro_pct numeric(7, 4) not null default 0 check (lucro_pct between 0 and 100),
  trib_lucro_pct numeric(7, 4) not null default 0 check (trib_lucro_pct between 0 and 100),
  provisionar boolean not null default true,
  adiantamento boolean not null default true,
  adiantamento_pct numeric(7, 4) not null default 40 check (adiantamento_pct between 0 and 100),
  rotatividade_pct numeric(7, 4) not null default 0 check (rotatividade_pct between 0 and 100),
  he_mix_util numeric(7, 4) not null default 70 check (he_mix_util between 0 and 100),
  he_mix_sabado numeric(7, 4) not null default 15 check (he_mix_sabado between 0 and 100),
  he_mix_intervalo numeric(7, 4) not null default 5 check (he_mix_intervalo between 0 and 100),
  he_mix_feriado numeric(7, 4) not null default 10 check (he_mix_feriado between 0 and 100),
  carregada_em timestamptz not null default now(),
  carregada_por uuid references auth.users (id) on delete set null,
  check (abs(he_mix_util + he_mix_sabado + he_mix_intervalo + he_mix_feriado - 100) < 0.01)
);
create unique index obras_nome_unico on public.obras (lower(nome));
create index obras_cidade on public.obras (cidade_id);
create index obras_data_base on public.obras (data_base);
comment on table public.obras is 'Obra concluída na base histórica (SPEC §1.2). Premissas em 0–100.';

create table public.obra_trocas_tabela (
  obra_id text not null references public.obras (id) on delete cascade,
  mes_idx integer not null check (mes_idx >= 1),
  data_base integer not null references public.datas_base (ano) on delete restrict,
  motivo text not null default '',
  primary key (obra_id, mes_idx)
);

create table public.obra_feriados (
  obra_id text not null references public.obras (id) on delete cascade,
  data date not null,
  nome text not null check (length(trim(nome)) > 0),
  primary key (obra_id, data)
);

-- Funções por prestador S/P (as demais são CLT).
create table public.obra_regime (
  obra_id text not null references public.obras (id) on delete cascade,
  funcao_id text not null references public.funcoes (id) on delete restrict on update cascade,
  regime public.regime not null,
  primary key (obra_id, funcao_id)
);

-- ── por competência ──────────────────────────────────────────────────────────
create table public.competencias (
  obra_id text not null references public.obras (id) on delete cascade,
  mes_idx integer not null check (mes_idx >= 0),
  he_media numeric(10, 4) not null default 0 check (he_media >= 0),
  absenteismo_pct numeric(7, 4) not null default 0 check (absenteismo_pct between 0 and 100),
  licenca_pessoa_dias numeric(10, 2) not null default 0 check (licenca_pessoa_dias >= 0),
  ferias_pessoa_dias numeric(10, 2) not null default 0 check (ferias_pessoa_dias >= 0),
  -- apropriação × ERP (SPEC §6.2): nulos sem relatório do ERP
  ito_apropriado numeric(14, 2),
  erp_realizado numeric(14, 2),
  justificativa text references public.justificativas_erp (texto) on update cascade,
  primary key (obra_id, mes_idx)
);

-- Derivado dos lançamentos na gravação (não vem pronto do cliente).
create table public.efetivo_mes (
  obra_id text not null references public.obras (id) on delete cascade,
  funcao_id text not null references public.funcoes (id) on delete restrict on update cascade,
  mes_idx integer not null check (mes_idx >= 0),
  equivalente numeric(10, 4) not null check (equivalente >= 0),
  cabecas integer not null check (cabecas >= 0),
  admissoes integer not null default 0 check (admissoes >= 0),
  desligamentos integer not null default 0 check (desligamentos >= 0),
  primary key (obra_id, funcao_id, mes_idx)
);
create index efetivo_mes_funcao on public.efetivo_mes (funcao_id);

-- ── por matrícula (sem nome) ─────────────────────────────────────────────────
create table public.lancamentos (
  obra_id text not null references public.obras (id) on delete cascade,
  mes_idx integer not null check (mes_idx >= 0),
  matricula text not null check (matricula ~ '^[0-9A-Za-z./-]{1,20}$'),
  funcao_id text not null references public.funcoes (id) on delete restrict on update cascade,
  -- fração do mês com vínculo (pessoa-mês equivalente desta matrícula)
  equivalente numeric(6, 4) not null check (equivalente between 0 and 1),
  horas_extras numeric(8, 2) not null default 0 check (horas_extras >= 0),
  faltas_horas numeric(8, 2) not null default 0 check (faltas_horas >= 0),
  licenca_dias numeric(5, 2) not null default 0 check (licenca_dias between 0 and 31),
  ferias_dias numeric(5, 2) not null default 0 check (ferias_dias between 0 and 31),
  admitido boolean not null default false,
  desligado boolean not null default false,
  sem_vt boolean not null default false,
  vt_valor numeric(12, 2) check (vt_valor >= 0),
  -- MDO realocada: trabalhou em outra obra; o custo sai desta (não entra no efetivo)
  realocada_para text,
  primary key (obra_id, mes_idx, matricula, funcao_id)
);
create index lancamentos_funcao on public.lancamentos (funcao_id);

create table public.lancamento_rubricas (
  obra_id text not null,
  mes_idx integer not null,
  matricula text not null,
  funcao_id text not null,
  rubrica_codigo integer not null references public.rubricas (codigo) on delete restrict,
  referencia numeric(12, 2) not null default 0,
  valor numeric(14, 2) not null,
  primary key (obra_id, mes_idx, matricula, funcao_id, rubrica_codigo),
  foreign key (obra_id, mes_idx, matricula, funcao_id)
    references public.lancamentos (obra_id, mes_idx, matricula, funcao_id) on delete cascade
);
create index lancamento_rubricas_rubrica on public.lancamento_rubricas (rubrica_codigo);

create table public.realocacoes (
  id bigint generated always as identity primary key,
  obra_id text not null references public.obras (id) on delete cascade,
  tipo public.tipo_realocacao not null,
  funcao_id text not null references public.funcoes (id) on delete restrict on update cascade,
  mes_ini integer not null check (mes_ini >= 0),
  mes_fim integer not null,
  qtd integer not null check (qtd > 0),
  outra_obra text not null check (length(trim(outra_obra)) > 0),
  outra_obra_id text references public.obras (id) on delete set null,
  saldo_vt numeric(12, 2) not null default 0,
  check (mes_fim >= mes_ini)
);
create index realocacoes_obra on public.realocacoes (obra_id);

-- NF de prestador S/P: só CNPJ do prestador (pessoa jurídica).
create table public.notas_fiscais (
  obra_id text not null references public.obras (id) on delete cascade,
  prestador_cnpj text not null check (prestador_cnpj ~ '^[0-9]{14}$'),
  numero text not null check (length(trim(numero)) > 0),
  mes_idx integer not null check (mes_idx >= 0),
  valor numeric(14, 2) not null check (valor >= 0),
  iss numeric(14, 2) not null default 0,
  pis numeric(14, 2) not null default 0,
  cofins numeric(14, 2) not null default 0,
  inss numeric(14, 2) not null default 0,
  ir numeric(14, 2) not null default 0,
  csll numeric(14, 2) not null default 0,
  primary key (obra_id, prestador_cnpj, numero)
);

create table public.erp_realizado (
  obra_id text not null references public.obras (id) on delete cascade,
  mes_idx integer not null check (mes_idx >= 0),
  conta text not null check (length(trim(conta)) > 0),
  valor numeric(14, 2) not null,
  primary key (obra_id, mes_idx, conta)
);

-- ── rascunho da carga (decisão M4: no banco, por usuário; sem nomes) ─────────
create table public.carga_rascunhos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default '',
  etapa integer not null default 1 check (etapa between 1 and 5),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index carga_rascunhos_usuario on public.carga_rascunhos (usuario_id);

create function public.carimbar_rascunho()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function public.carimbar_rascunho() from public, anon, authenticated;
create trigger carimbar before update on public.carga_rascunhos
  for each row execute function public.carimbar_rascunho();

-- ── acesso ───────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['justificativas_erp', 'obras', 'obra_trocas_tabela', 'obra_feriados',
    'obra_regime', 'competencias', 'efetivo_mes', 'lancamentos', 'lancamento_rubricas',
    'realocacoes', 'notas_fiscais', 'erp_realizado'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('create policy ler on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

alter table public.carga_rascunhos enable row level security;
revoke all on table public.carga_rascunhos from anon, authenticated;
grant select, insert, delete on table public.carga_rascunhos to authenticated;
grant update (titulo, etapa, dados) on table public.carga_rascunhos to authenticated;
create policy ler on public.carga_rascunhos for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.sou_admin()));
create policy criar on public.carga_rascunhos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select public.pode_carregar()));
create policy alterar on public.carga_rascunhos for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy apagar on public.carga_rascunhos for delete to authenticated
  using (usuario_id = (select auth.uid()) or (select public.sou_admin()));

-- ── gravação ─────────────────────────────────────────────────────────────────
create function public.exigir_carga()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.pode_carregar() then
    raise exception 'Só DP/RH, controladoria ou um administrador carrega obras.'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.exigir_carga() from public, anon;
grant execute on function public.exigir_carga() to authenticated;

/*
  Grava uma obra inteira numa transação. `p` (montado por @ito/carga, `CargaParaGravar`):
  { obra: {...colunas de obras...}, substituir: bool,
    trocas: [{mes_idx, data_base, motivo}], feriados: [{data, nome}], regime: [{funcao_id, regime}],
    sinonimos: [{texto, funcao_id}], rubricas_novas: [{codigo, nome, tipo, componente, base_provisoes, tipo_he}],
    competencias: [{mes_idx, he_media, absenteismo_pct, licenca_pessoa_dias, ferias_pessoa_dias,
                    ito_apropriado, erp_realizado, justificativa}],
    lancamentos: [{mes_idx, matricula, funcao_id, equivalente, horas_extras, faltas_horas, licenca_dias,
                   ferias_dias, admitido, desligado, sem_vt, vt_valor, realocada_para,
                   rubricas: [{codigo, referencia, valor}]}],
    realocacoes: [...], notas: [...], erp: [{mes_idx, conta, valor}] }
  Pendências bloqueantes (SPEC §6.3): função sem mapeamento, rubrica sem classificação, NF sem
  competência; e (decisão M4) diferença com o ERP ≥ R$ 1 sem justificativa.
*/
create function public.gravar_carga(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := p -> 'obra';
  v_id text := o ->> 'id';
  v_meses integer := (o ->> 'meses')::integer;
  faltando text;
begin
  perform public.exigir_carga();
  if v_id is null or v_meses is null then
    raise exception 'Informe o código e o número de meses da obra.' using errcode = '22023';
  end if;

  if exists (select 1 from public.obras where id = v_id) then
    if coalesce((p ->> 'substituir')::boolean, false) then
      delete from public.obras where id = v_id;
    else
      raise exception 'Já existe uma obra com o código %. Escolha outro código ou confirme a substituição.', v_id
        using errcode = '23505';
    end if;
  end if;

  -- sinônimos e rubricas novas entram antes (quem carrega também edita cadastros)
  insert into public.funcao_sinonimos (texto, funcao_id)
    select upper(trim(s ->> 'texto')), s ->> 'funcao_id' from jsonb_array_elements(coalesce(p -> 'sinonimos', '[]')) s
    on conflict (texto) do update set funcao_id = excluded.funcao_id;
  insert into public.rubricas (codigo, nome, tipo, componente, base_provisoes, tipo_he)
    select (r ->> 'codigo')::integer, trim(r ->> 'nome'), (r ->> 'tipo')::public.tipo_rubrica,
           (r ->> 'componente')::public.componente_rubrica, coalesce((r ->> 'base_provisoes')::boolean, false),
           nullif(r ->> 'tipo_he', '')
    from jsonb_array_elements(coalesce(p -> 'rubricas_novas', '[]')) r
    where (r ->> 'codigo')::integer not in (select codigo from public.rubricas);

  -- pendências bloqueantes, com a ação a tomar
  select string_agg(distinct l ->> 'funcao_id', ', ') into faltando
    from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l
    where not exists (select 1 from public.funcoes f where f.id = l ->> 'funcao_id');
  if faltando is not null then
    raise exception 'Funções da folha sem função padrão: %. Mapeie-as na etapa Funções.', faltando
      using errcode = '23503';
  end if;
  select string_agg(distinct r ->> 'codigo', ', ') into faltando
    from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l,
         jsonb_array_elements(coalesce(l -> 'rubricas', '[]')) r
    where not exists (select 1 from public.rubricas x where x.codigo = (r ->> 'codigo')::integer);
  if faltando is not null then
    raise exception 'Rubricas sem classificação: %. Classifique-as na etapa Rubricas.', faltando
      using errcode = '23503';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'notas', '[]')) n
             where n ->> 'mes_idx' is null) then
    raise exception 'Há nota fiscal sem competência. Escolha o mês de cada nota na verificação.'
      using errcode = '23502';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'competencias', '[]')) c
             where c ->> 'erp_realizado' is not null
               and abs((c ->> 'erp_realizado')::numeric - coalesce((c ->> 'ito_apropriado')::numeric, 0)) >= 1
               and nullif(c ->> 'justificativa', '') is null) then
    raise exception 'Há mês com diferença de apropriação × ERP sem justificativa. Justifique na verificação.'
      using errcode = '23502';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l
             where (l ->> 'mes_idx')::integer not between 0 and v_meses - 1) then
    raise exception 'Há lançamento fora do período da obra. Confira as datas de início e fim.'
      using errcode = '22023';
  end if;

  insert into public.obras (id, nome, cliente, tipologia, cidade_id, area_m2, inicio, meses, data_base,
    fora_da_sede, grat_premios_pct, transf_pct, funcoes_transferidas, risco_pct, lucro_pct, trib_lucro_pct,
    provisionar, adiantamento, adiantamento_pct, rotatividade_pct,
    he_mix_util, he_mix_sabado, he_mix_intervalo, he_mix_feriado, carregada_por)
  select v_id, trim(x.nome), coalesce(x.cliente, ''), coalesce(x.tipologia, ''), nullif(x.cidade_id, ''),
    x.area_m2, x.inicio, x.meses, x.data_base, coalesce(x.fora_da_sede, false),
    coalesce(x.grat_premios_pct, 3), coalesce(x.transf_pct, 25), coalesce(x.funcoes_transferidas, '{}'),
    coalesce(x.risco_pct, 0), coalesce(x.lucro_pct, 0), coalesce(x.trib_lucro_pct, 0),
    coalesce(x.provisionar, true), coalesce(x.adiantamento, true), coalesce(x.adiantamento_pct, 40),
    coalesce(x.rotatividade_pct, 0), coalesce(x.he_mix_util, 70), coalesce(x.he_mix_sabado, 15),
    coalesce(x.he_mix_intervalo, 5), coalesce(x.he_mix_feriado, 10), auth.uid()
  from jsonb_populate_record(null::public.obras, o) x;

  insert into public.obra_trocas_tabela (obra_id, mes_idx, data_base, motivo)
    select v_id, x.mes_idx, x.data_base, coalesce(x.motivo, '')
    from jsonb_populate_recordset(null::public.obra_trocas_tabela, coalesce(p -> 'trocas', '[]')) x;
  insert into public.obra_feriados (obra_id, data, nome)
    select v_id, x.data, x.nome
    from jsonb_populate_recordset(null::public.obra_feriados, coalesce(p -> 'feriados', '[]')) x;
  insert into public.obra_regime (obra_id, funcao_id, regime)
    select v_id, x.funcao_id, x.regime
    from jsonb_populate_recordset(null::public.obra_regime, coalesce(p -> 'regime', '[]')) x;

  insert into public.competencias (obra_id, mes_idx, he_media, absenteismo_pct, licenca_pessoa_dias,
    ferias_pessoa_dias, ito_apropriado, erp_realizado, justificativa)
  select v_id, x.mes_idx, coalesce(x.he_media, 0), coalesce(x.absenteismo_pct, 0),
    coalesce(x.licenca_pessoa_dias, 0), coalesce(x.ferias_pessoa_dias, 0), x.ito_apropriado,
    x.erp_realizado, nullif(x.justificativa, '')
  from jsonb_populate_recordset(null::public.competencias, coalesce(p -> 'competencias', '[]')) x;

  insert into public.lancamentos (obra_id, mes_idx, matricula, funcao_id, equivalente, horas_extras,
    faltas_horas, licenca_dias, ferias_dias, admitido, desligado, sem_vt, vt_valor, realocada_para)
  select v_id, x.mes_idx, x.matricula, x.funcao_id, x.equivalente, coalesce(x.horas_extras, 0),
    coalesce(x.faltas_horas, 0), coalesce(x.licenca_dias, 0), coalesce(x.ferias_dias, 0),
    coalesce(x.admitido, false), coalesce(x.desligado, false), coalesce(x.sem_vt, false), x.vt_valor,
    nullif(trim(x.realocada_para), '')
  from jsonb_populate_recordset(null::public.lancamentos, coalesce(p -> 'lancamentos', '[]')) x;

  insert into public.lancamento_rubricas (obra_id, mes_idx, matricula, funcao_id, rubrica_codigo, referencia, valor)
  select v_id, (l ->> 'mes_idx')::integer, l ->> 'matricula', l ->> 'funcao_id', (r ->> 'codigo')::integer,
    coalesce((r ->> 'referencia')::numeric, 0), (r ->> 'valor')::numeric
  from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l,
       jsonb_array_elements(coalesce(l -> 'rubricas', '[]')) r;

  -- efetivo por função e mês: só quem trabalhou nesta obra (MDO realocada fica de fora)
  insert into public.efetivo_mes (obra_id, funcao_id, mes_idx, equivalente, cabecas, admissoes, desligamentos)
  select v_id, funcao_id, mes_idx, sum(equivalente), count(distinct matricula),
    count(*) filter (where admitido), count(*) filter (where desligado)
  from public.lancamentos
  where obra_id = v_id and realocada_para is null
  group by funcao_id, mes_idx;

  insert into public.realocacoes (obra_id, tipo, funcao_id, mes_ini, mes_fim, qtd, outra_obra, outra_obra_id, saldo_vt)
  select v_id, x.tipo, x.funcao_id, x.mes_ini, x.mes_fim, x.qtd, x.outra_obra, nullif(x.outra_obra_id, ''),
    coalesce(x.saldo_vt, 0)
  from jsonb_populate_recordset(null::public.realocacoes, coalesce(p -> 'realocacoes', '[]')) x;

  insert into public.notas_fiscais (obra_id, prestador_cnpj, numero, mes_idx, valor, iss, pis, cofins, inss, ir, csll)
  select v_id, x.prestador_cnpj, x.numero, x.mes_idx, x.valor, coalesce(x.iss, 0), coalesce(x.pis, 0),
    coalesce(x.cofins, 0), coalesce(x.inss, 0), coalesce(x.ir, 0), coalesce(x.csll, 0)
  from jsonb_populate_recordset(null::public.notas_fiscais, coalesce(p -> 'notas', '[]')) x;

  insert into public.erp_realizado (obra_id, mes_idx, conta, valor)
  select v_id, x.mes_idx, x.conta, x.valor
  from jsonb_populate_recordset(null::public.erp_realizado, coalesce(p -> 'erp', '[]')) x;

  return v_id;
end;
$$;

create function public.excluir_obra(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_carga();
  delete from public.obras where id = p_id;
  if not found then
    raise exception 'A obra não existe. Atualize a página.' using errcode = 'P0002';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['gravar_carga(jsonb)', 'excluir_obra(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
