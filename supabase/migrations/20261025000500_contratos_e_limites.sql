-- M13 · S04 e S07 (auditoria de segurança): os JSON da projeção não tinham contrato no banco
-- (uma chamada direta gravava ajustes como texto) e as gravações da carga, dos resumos e dos
-- rascunhos não tinham teto de tamanho. Os contratos seguem o que a tela grava
-- (apps/web/src/lib/projecaoDoBanco.ts) e o motor aceita; os limites dão folga ampla sobre a
-- maior obra real (≈ 600 lançamentos).

-- ---------------------------------------------------------------- contratos da projeção (S04)

-- objeto de números entre min e max, com até n chaves curtas (ajustes, mix de HE); com chaves,
-- só elas são aceitas
create function public.json_numeros(j jsonb, minimo numeric, maximo numeric, n integer,
                                    chaves text[] default null)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and (select count(*) from jsonb_object_keys(j)) <= n
     and not exists (select 1 from jsonb_each(j) e
                     where length(e.key) > 64 or jsonb_typeof(e.value) <> 'number'
                        or (e.value #>> '{}')::numeric not between minimo and maximo
                        or (chaves is not null and not e.key = any (chaves)));
$$;

-- objeto de textos de uma lista fechada (regime e origem por função)
create function public.json_opcoes(j jsonb, opcoes text[], n integer)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and (select count(*) from jsonb_object_keys(j)) <= n
     and not exists (select 1 from jsonb_each(j) e
                     where length(e.key) > 64 or jsonb_typeof(e.value) <> 'string'
                        or not (e.value #>> '{}') = any (opcoes));
$$;

-- quantidades informadas: por função, uma lista de pessoas por mês (até 120 meses)
create function public.json_quantidades(j jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and (select count(*) from jsonb_object_keys(j)) <= 300
     and not exists (
       select 1 from jsonb_each(j) e
       where length(e.key) > 64 or jsonb_typeof(e.value) <> 'array'
          or jsonb_array_length(e.value) > 120
          or exists (select 1 from jsonb_array_elements(e.value) x
                     where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric not between 0 and 100000));
$$;

-- premissas de custo (motor: Premissas), todas opcionais
create function public.json_premissas(j jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and not exists (
       select 1 from jsonb_each(j) e
       where case
         when e.key in ('gratPremiosPct', 'transfPct', 'riscoPct', 'lucroPct', 'tribLucroPct',
                        'adiantamentoPct')
           then jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric not between 0 and 100
         -- foraDaSede: chave antiga (até o M11), ainda em projeções salvas antes; o motor ignora
         when e.key in ('provisionar', 'adiantamento', 'foraDaSede') then jsonb_typeof(e.value) <> 'boolean'
         when e.key = 'funcoesTransferidas'
           then jsonb_typeof(e.value) <> 'array' or jsonb_array_length(e.value) > 300
                or exists (select 1 from jsonb_array_elements(e.value) x
                           where jsonb_typeof(x) <> 'string' or length(x #>> '{}') > 64)
         else true
       end);
$$;

-- resumo da lista (total, pico, pessoa-mês, data-base vigente)
create function public.json_resumo(j jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
     and not exists (select 1 from jsonb_each(j) e
                     -- indireta_pct: chave antiga (até 23/10/2026), ainda em projeções salvas antes
                    where e.key not in ('total', 'pico', 'pessoa_mes', 'vigente', 'indireta_pct')
                        or jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric < 0);
$$;

revoke all on function public.json_numeros(jsonb, numeric, numeric, integer, text[]) from public, anon;
revoke all on function public.json_opcoes(jsonb, text[], integer) from public, anon;
revoke all on function public.json_quantidades(jsonb) from public, anon;
revoke all on function public.json_premissas(jsonb) from public, anon;
revoke all on function public.json_resumo(jsonb) from public, anon;

alter table public.projecoes
  add constraint projecoes_ajustes_contrato
    check (ajustes is null or public.json_numeros(ajustes, -100, 100, 300)),
  add constraint projecoes_quantidades_contrato
    check (quantidades_manuais is null or public.json_quantidades(quantidades_manuais)),
  add constraint projecoes_he_mix_contrato
    check (he_mix is null
           or public.json_numeros(he_mix, 0, 100, 4, array['util', 'sabado', 'intervalo', 'feriado'])),
  add constraint projecoes_premissas_contrato
    check (premissas is null or public.json_premissas(premissas)),
  add constraint projecoes_regime_contrato
    check (regime is null or public.json_opcoes(regime, array['clt', 'sp'], 300)),
  add constraint projecoes_origem_contrato
    check (origem is null or public.json_opcoes(origem, array['local', 'diaria', 'aloj'], 300)),
  add constraint projecoes_resumo_contrato
    check (resumo is null or public.json_resumo(resumo)),
  add constraint projecoes_referencias_limite
    check (cardinality(referencias) <= 5000);

-- ---------------------------------------------------------------- rascunhos da carga (S07)

alter table public.carga_rascunhos
  add constraint carga_rascunhos_dados_limite check (octet_length(dados::text) <= 10 * 1024 * 1024),
  add constraint carga_rascunhos_leituras_limite
    check (leituras is null or octet_length(leituras::text) <= 60 * 1024 * 1024);

-- até 20 rascunhos por pessoa (os antigos saem sozinhos em 90 dias, S01)
create function public.limitar_rascunhos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.carga_rascunhos r where r.usuario_id = new.usuario_id) >= 20 then
    raise exception 'Você já tem 20 rascunhos de carga. Apague os que não usa antes de começar outro.'
      using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.limitar_rascunhos() from public, anon, authenticated;
create trigger limitar_rascunhos before insert on public.carga_rascunhos
  for each row execute function public.limitar_rascunhos();

-- ---------------------------------------------------------------- lotes das RPCs (S07)

-- pedido da carga: um objeto de até 100 MB (a maior obra real tem menos de 1 MB)
create function public.exigir_lote(p jsonb, tipo text, max_bytes bigint)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p) <> tipo then
    raise exception 'Pedido inválido. Atualize a página e tente de novo.' using errcode = '22023';
  end if;
  if octet_length(p::text) > max_bytes then
    raise exception 'Pedido grande demais: divida a carga por período e envie em partes.'
      using errcode = '54000';
  end if;
end;
$$;
revoke all on function public.exigir_lote(jsonb, text, bigint) from public, anon;

create or replace function public.gravar_carga(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  id text;
begin
  perform public.exigir_lote(p, 'object', 100 * 1024 * 1024);
  perform set_config('ito.carga', 'on', true);
  id := public.gravar_carga_dados(p);
  perform set_config('ito.carga', '', true);
  return id;
end;
$$;

create or replace function public.lancar_mes(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m integer;
begin
  perform public.exigir_lote(p, 'object', 100 * 1024 * 1024);
  perform set_config('ito.carga', 'on', true);
  m := public.lancar_mes_dados(p);
  perform set_config('ito.carga', '', true);
  return m;
end;
$$;

-- resumos das obras: até 5.000 por chamada (a base sintética de desempenho tem 1.000)
create or replace function public.gravar_resumos(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not (public.pode_carregar() or public.pode_editar_config()) then
    raise exception 'Só DP/RH, controladoria ou um administrador atualiza o resumo das obras.'
      using errcode = '42501';
  end if;
  perform public.exigir_lote(coalesce(p, '[]'), 'array', 50 * 1024 * 1024);
  if jsonb_array_length(coalesce(p, '[]')) > 5000 then
    raise exception 'Envie até 5.000 resumos por vez.' using errcode = '54000';
  end if;
  insert into public.obra_resumo (obra_id, vigente, versao, contexto, revisao, pico, pessoa_mes,
    he_por_pessoa, custo_epoca, custo_atual, histograma, atualizado_em)
  select x.obra_id, x.vigente, coalesce(x.versao, 1), coalesce(x.contexto, ''), x.revisao, x.pico,
    x.pessoa_mes, x.he_por_pessoa, x.custo_epoca, x.custo_atual,
    coalesce(x.histograma, '{}'), now()
  from jsonb_populate_recordset(null::public.obra_resumo, coalesce(p, '[]')) x
  -- só a revisão que o cliente leu (outra pessoa pode ter editado a obra no meio do cálculo)
  where exists (select 1 from public.obras o where o.id = x.obra_id and o.revisao = x.revisao)
  on conflict (obra_id) do update set
    vigente = excluded.vigente, versao = excluded.versao, contexto = excluded.contexto,
    revisao = excluded.revisao, pico = excluded.pico, pessoa_mes = excluded.pessoa_mes,
    he_por_pessoa = excluded.he_por_pessoa,
    custo_epoca = excluded.custo_epoca, custo_atual = excluded.custo_atual,
    histograma = excluded.histograma, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end;
$$;
