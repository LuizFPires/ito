-- M2 — Cidades e convenções coletivas (SPEC §1.1).
-- CCT: salários, gratificações fixas e benefícios por função, mês da data-base (1–12) e
-- reajuste estimado. Cidade: CCT que vale, tarifa, conduções, ISS, feriados recorrentes e
-- passagem para quem vem de outra cidade. Edição: controladoria e admin (decisão M2).

-- ── convenções ───────────────────────────────────────────────────────────────
create table public.ccts (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,47}$'),
  nome text not null check (length(trim(nome)) > 0),
  mes_data_base integer not null default 5 check (mes_data_base between 1 and 12),
  reajuste_estimado_pct numeric(7, 4) not null default 0 check (reajuste_estimado_pct between -50 and 100),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
create unique index ccts_nome_unico on public.ccts (lower(nome));

create table public.cct_salarios (
  cct_id text not null references public.ccts (id) on delete cascade,
  funcao_id text not null references public.funcoes (id) on delete restrict,
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (cct_id, funcao_id)
);

create table public.cct_gratificacoes (
  cct_id text not null references public.ccts (id) on delete cascade,
  funcao_id text not null references public.funcoes (id) on delete restrict,
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (cct_id, funcao_id)
);

create table public.cct_beneficios (
  cct_id text not null references public.ccts (id) on delete cascade,
  beneficio_id text not null references public.beneficios (id) on delete restrict,
  valor numeric(12, 2) not null check (valor >= 0),
  primary key (cct_id, beneficio_id)
);

-- ── cidades ──────────────────────────────────────────────────────────────────
create table public.cidades (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,47}$'),
  nome text not null check (length(trim(nome)) > 0),
  uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
  cct_id text not null references public.ccts (id) on delete restrict,
  tarifa_local numeric(10, 2) not null default 0 check (tarifa_local >= 0),
  conducoes integer not null default 1 check (conducoes between 1 and 10),
  iss_pct numeric(7, 4) not null default 3 check (iss_pct between 0 and 10),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
create unique index cidades_nome_uf on public.cidades (lower(nome), uf);
create index cidades_cct on public.cidades (cct_id);

-- Feriados municipais recorrentes (todo ano): dia + mês.
create table public.cidade_feriados (
  cidade_id text not null references public.cidades (id) on delete cascade,
  mes integer not null check (mes between 1 and 12),
  dia integer not null check (dia between 1 and 31),
  nome text not null check (length(trim(nome)) > 0),
  primary key (cidade_id, mes, dia),
  check (make_date(2024, mes, dia) is not null) -- 2024 é bissexto: aceita 29/02, recusa 31/04
);

-- Passagem por trajeto para quem mora em `origem_id` e trabalha em `cidade_id`.
create table public.cidade_passagens (
  cidade_id text not null references public.cidades (id) on delete cascade,
  origem_id text not null references public.cidades (id) on delete cascade,
  valor numeric(10, 2) not null check (valor > 0),
  primary key (cidade_id, origem_id),
  check (cidade_id <> origem_id)
);

-- ── carimbo e acesso ─────────────────────────────────────────────────────────
create trigger carimbar before insert or update on public.ccts
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.cidades
  for each row execute function public.carimbar_alteracao();

do $$
declare
  t text;
begin
  foreach t in array array['ccts', 'cct_salarios', 'cct_gratificacoes', 'cct_beneficios',
                           'cidades', 'cidade_feriados', 'cidade_passagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, delete on table public.%I to authenticated', t);
    execute format('create policy ler on public.%I for select to authenticated using (true)', t);
    execute format('create policy editar on public.%I for all to authenticated
      using ((select public.pode_editar_config())) with check ((select public.pode_editar_config()))', t);
  end loop;
end $$;

-- UPDATE por coluna (sem chaves nem carimbo); upsert reescreve a chave com o mesmo valor.
grant update (nome, mes_data_base, reajuste_estimado_pct) on public.ccts to authenticated;
grant update (cct_id, funcao_id, valor) on public.cct_salarios to authenticated;
grant update (cct_id, funcao_id, valor) on public.cct_gratificacoes to authenticated;
grant update (cct_id, beneficio_id, valor) on public.cct_beneficios to authenticated;
grant update (nome, uf, cct_id, tarifa_local, conducoes, iss_pct) on public.cidades to authenticated;
grant update (nome) on public.cidade_feriados to authenticated;
grant update (cidade_id, origem_id, valor) on public.cidade_passagens to authenticated;

-- ── operações ────────────────────────────────────────────────────────────────
create function public.exigir_config()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.pode_editar_config() then
    raise exception 'Só a controladoria ou um administrador altera cidades e convenções.'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.exigir_config() from public, anon;
grant execute on function public.exigir_config() to authenticated;

-- Nova CCT: salários e benefícios da data-base vigente, sem gratificações (decisão M2).
create function public.criar_cct(p_id text, p_nome text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  vig integer := (select data_base_vigente from public.parametros);
begin
  perform public.exigir_config();
  insert into public.ccts (id, nome) values (p_id, trim(p_nome));
  insert into public.cct_salarios (cct_id, funcao_id, valor)
    select p_id, funcao_id, valor from public.data_base_salarios where ano = vig;
  insert into public.cct_beneficios (cct_id, beneficio_id, valor)
    select p_id, beneficio_id, valor from public.data_base_beneficios where ano = vig;
  return p_id;
end;
$$;

-- Duplicar: tudo da CCT de origem, menos as cidades.
create function public.duplicar_cct(p_origem text, p_id text, p_nome text)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  perform public.exigir_config();
  insert into public.ccts (id, nome, mes_data_base, reajuste_estimado_pct)
    select p_id, trim(p_nome), mes_data_base, reajuste_estimado_pct from public.ccts where id = p_origem;
  if not found then
    raise exception 'A convenção de origem não existe. Atualize a página.' using errcode = '23503';
  end if;
  insert into public.cct_salarios select p_id, funcao_id, valor from public.cct_salarios where cct_id = p_origem;
  insert into public.cct_gratificacoes select p_id, funcao_id, valor from public.cct_gratificacoes where cct_id = p_origem;
  insert into public.cct_beneficios select p_id, beneficio_id, valor from public.cct_beneficios where cct_id = p_origem;
  return p_id;
end;
$$;

-- Ajuste em lote: % sobre salários e gratificações da CCT (centavos).
create function public.ajustar_cct(p_cct text, p_pct numeric)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  fator numeric := 1 + p_pct / 100;
  n integer;
begin
  perform public.exigir_config();
  if p_pct is null or p_pct < -50 or p_pct > 100 then
    raise exception 'Informe um ajuste entre -50%% e 100%%.' using errcode = '22023';
  end if;
  update public.cct_salarios set valor = round(valor * fator, 2) where cct_id = p_cct;
  get diagnostics n = row_count;
  update public.cct_gratificacoes set valor = round(valor * fator, 2) where cct_id = p_cct;
  return n;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['criar_cct(text, text)', 'duplicar_cct(text, text, text)', 'ajustar_cct(text, numeric)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
