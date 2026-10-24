-- M11 — Obras em andamento. A obra pode começar no ITO antes de terminar: nasce "em andamento"
-- (só o cadastro, ou com os meses que já tiver), recebe a folha mês a mês e é concluída no fim.
-- As obras já carregadas ficam concluídas. Só as concluídas servem de referência para projeções.

create type public.situacao_obra as enum ('andamento', 'concluida');
comment on type public.situacao_obra is 'Obra recebendo meses (andamento) ou fechada (concluida).';

alter table public.obras add column situacao public.situacao_obra not null default 'concluida';
-- prazo previsto da obra em andamento (informativo: "mês 3 de 14")
alter table public.obras add column prazo_previsto integer check (prazo_previsto between 1 and 120);

-- em andamento a obra pode ainda não ter mês lançado; concluída tem ao menos um
alter table public.obras drop constraint obras_meses_check;
alter table public.obras add constraint obras_meses_check check (meses between 0 and 120);
alter table public.obras add constraint obras_concluida_com_meses
  check (meses >= 1 or situacao = 'andamento');
comment on table public.obras is
  'Obra da base histórica (SPEC §1.2): concluída ou em andamento (recebe a folha mês a mês). Premissas em 0–100.';

-- decisão do usuário (M11): sem "obra fora da sede"; alojamento vem só da origem da MO
revoke update (fora_da_sede) on public.obras from authenticated;
alter table public.obras drop column fora_da_sede;
grant update (prazo_previsto) on public.obras to authenticated;

-- ── verificações bloqueantes da carga (obra inteira e mês lançado) ─────────
create function public.validar_carga(p jsonb, v_meses integer)
returns void language plpgsql stable set search_path = '' as $$
declare
  faltando text;
begin
  select string_agg(distinct l ->> 'funcao_id', ', ') into faltando
    from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l
    where not exists (select 1 from public.funcoes f where f.id = l ->> 'funcao_id');
  if faltando is not null then
    raise exception 'Funções da folha sem função padrão: %. Mapeie-as na etapa Funções.', faltando
      using errcode = '23503';
  end if;
  select string_agg(distinct x, ', ') into faltando
    from jsonb_array_elements_text(coalesce(p -> 'obra' -> 'funcoes_transferidas', '[]')) x
    where not exists (select 1 from public.funcoes f where f.id = x);
  if faltando is not null then
    raise exception 'Funções transferidas sem cadastro: %. Escolha funções padrão na etapa Obra.', faltando
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

  -- todo mês dentro do período (troca de tabela: do 2º mês em diante)
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l
             where (l ->> 'mes_idx')::integer not between 0 and v_meses - 1)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'competencias', '[]')) c
             where (c ->> 'mes_idx')::integer not between 0 and v_meses - 1)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'notas', '[]')) n
             where (n ->> 'mes_idx')::integer not between 0 and v_meses - 1)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'erp', '[]')) e
             where (e ->> 'mes_idx')::integer not between 0 and v_meses - 1)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'realocacoes', '[]')) r
             where (r ->> 'mes_ini')::integer < 0 or (r ->> 'mes_fim')::integer > v_meses - 1)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'trocas', '[]')) t
             where (t ->> 'mes_idx')::integer not between 1 and v_meses - 1) then
    raise exception 'Há mês fora do período da obra (lançamento, competência, nota, ERP, realocação ou troca de tabela). Confira as datas de início e fim.'
      using errcode = '22023';
  end if;

  -- apropriação × ERP: o realizado vem das linhas do ERP, somadas aqui
  if exists (
    with erp as (
      select (e ->> 'mes_idx')::integer as mes, sum((e ->> 'valor')::numeric) as valor
      from jsonb_array_elements(coalesce(p -> 'erp', '[]')) e group by 1
    ), comp as (
      select (c ->> 'mes_idx')::integer as mes, (c ->> 'ito_apropriado')::numeric as ito,
             nullif(c ->> 'justificativa', '') as just
      from jsonb_array_elements(coalesce(p -> 'competencias', '[]')) c
    )
    select 1 from erp left join comp using (mes)
    where abs(erp.valor - coalesce(comp.ito, 0)) >= 1 and comp.just is null
  ) then
    raise exception 'Há mês com diferença de apropriação × ERP sem justificativa. Justifique na verificação.'
      using errcode = '23502';
  end if;
end;
$$;
revoke all on function public.validar_carga(jsonb, integer) from public, anon, authenticated;

-- sinônimos e rubricas novas da folha (quem carrega também edita esses cadastros)
create function public.gravar_cadastros_da_carga(p jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.funcao_sinonimos (texto, funcao_id)
    select upper(trim(s ->> 'texto')), s ->> 'funcao_id' from jsonb_array_elements(coalesce(p -> 'sinonimos', '[]')) s
    on conflict (texto) do update set funcao_id = excluded.funcao_id;
  insert into public.rubricas (codigo, nome, tipo, componente, base_provisoes, tipo_he)
    select (r ->> 'codigo')::integer, trim(r ->> 'nome'), (r ->> 'tipo')::public.tipo_rubrica,
           (r ->> 'componente')::public.componente_rubrica, coalesce((r ->> 'base_provisoes')::boolean, false),
           nullif(r ->> 'tipo_he', '')
    from jsonb_array_elements(coalesce(p -> 'rubricas_novas', '[]')) r
    where (r ->> 'codigo')::integer not in (select codigo from public.rubricas);
end;
$$;
revoke all on function public.gravar_cadastros_da_carga(jsonb) from public, anon, authenticated;

-- linhas por mês da folha (lançamentos, competências, ERP, NF, realocações) e o efetivo dos meses
-- gravados; a obra já existe
create function public.gravar_meses_da_carga(v_id text, p jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.erp_realizado (obra_id, mes_idx, conta, valor)
  select v_id, x.mes_idx, x.conta, x.valor
  from jsonb_populate_recordset(null::public.erp_realizado, coalesce(p -> 'erp', '[]')) x;

  -- realizado do ERP por mês calculado aqui (nulo sem relatório do ERP)
  insert into public.competencias (obra_id, mes_idx, he_media, absenteismo_pct, licenca_pessoa_dias,
    ferias_pessoa_dias, ito_apropriado, erp_realizado, justificativa)
  select v_id, x.mes_idx, coalesce(x.he_media, 0), coalesce(x.absenteismo_pct, 0),
    coalesce(x.licenca_pessoa_dias, 0), coalesce(x.ferias_pessoa_dias, 0), x.ito_apropriado,
    case when jsonb_array_length(coalesce(p -> 'erp', '[]')) > 0 then
      coalesce((select sum(e.valor) from public.erp_realizado e
                where e.obra_id = v_id and e.mes_idx = x.mes_idx), 0)
    end,
    nullif(x.justificativa, '')
  from jsonb_populate_recordset(null::public.competencias, coalesce(p -> 'competencias', '[]')) x;

  insert into public.lancamentos (obra_id, mes_idx, matricula, funcao_id, construtora, equivalente, horas_extras,
    faltas_horas, licenca_dias, ferias_dias, admitido, desligado, sem_vt, vt_valor, realocada_para)
  select v_id, x.mes_idx, x.matricula, x.funcao_id, coalesce(x.construtora, 'classica'), x.equivalente,
    coalesce(x.horas_extras, 0),
    coalesce(x.faltas_horas, 0), coalesce(x.licenca_dias, 0), coalesce(x.ferias_dias, 0),
    coalesce(x.admitido, false), coalesce(x.desligado, false), coalesce(x.sem_vt, false), x.vt_valor,
    nullif(trim(x.realocada_para), '')
  from jsonb_populate_recordset(null::public.lancamentos, coalesce(p -> 'lancamentos', '[]')) x;

  insert into public.lancamento_rubricas (obra_id, mes_idx, matricula, funcao_id, construtora, rubrica_codigo,
    referencia, valor)
  select v_id, (l ->> 'mes_idx')::integer, l ->> 'matricula', l ->> 'funcao_id',
    coalesce(nullif(l ->> 'construtora', ''), 'classica')::public.construtora, (r ->> 'codigo')::integer,
    coalesce((r ->> 'referencia')::numeric, 0), (r ->> 'valor')::numeric
  from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l,
       jsonb_array_elements(coalesce(l -> 'rubricas', '[]')) r;

  -- efetivo por função e mês: só quem trabalhou nesta obra (MDO realocada fica de fora); cabeça =
  -- matrícula (em cada construtora) com pessoa-mês no mês (rubrica paga depois da saída não conta)
  insert into public.efetivo_mes (obra_id, funcao_id, mes_idx, equivalente, cabecas, admissoes, desligamentos)
  select v_id, funcao_id, mes_idx, sum(equivalente),
    count(distinct (matricula, construtora)) filter (where equivalente > 0),
    count(*) filter (where admitido), count(*) filter (where desligado)
  from public.lancamentos
  where obra_id = v_id and realocada_para is null
    and mes_idx in (select (c ->> 'mes_idx')::integer from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) c)
  group by funcao_id, mes_idx;

  insert into public.realocacoes (obra_id, tipo, funcao_id, mes_ini, mes_fim, qtd, outra_obra, outra_obra_id, saldo_vt)
  select v_id, x.tipo, x.funcao_id, x.mes_ini, x.mes_fim, x.qtd, x.outra_obra, nullif(x.outra_obra_id, ''),
    coalesce(x.saldo_vt, 0)
  from jsonb_populate_recordset(null::public.realocacoes, coalesce(p -> 'realocacoes', '[]')) x;

  insert into public.notas_fiscais (obra_id, prestador_cnpj, numero, mes_idx, valor, iss, pis, cofins, inss, ir, csll)
  select v_id, x.prestador_cnpj, x.numero, x.mes_idx, x.valor, coalesce(x.iss, 0), coalesce(x.pis, 0),
    coalesce(x.cofins, 0), coalesce(x.inss, 0), coalesce(x.ir, 0), coalesce(x.csll, 0)
  from jsonb_populate_recordset(null::public.notas_fiscais, coalesce(p -> 'notas', '[]')) x;
end;
$$;
revoke all on function public.gravar_meses_da_carga(text, jsonb) from public, anon, authenticated;

-- ── carga da obra inteira (concluída) ou do começo de uma obra em andamento ─
create or replace function public.gravar_carga_dados(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := p -> 'obra';
  v_id text := o ->> 'id';
  v_meses integer := (o ->> 'meses')::integer;
  v_situacao public.situacao_obra := coalesce(nullif(o ->> 'situacao', ''), 'concluida')::public.situacao_obra;
begin
  perform public.exigir_carga();
  if v_id is null or v_meses is null then
    raise exception 'Informe o código e o número de meses da obra.' using errcode = '22023';
  end if;
  if v_meses < 1 and v_situacao = 'concluida' then
    raise exception 'Obra concluída precisa da folha de ao menos um mês. Envie a folha ou marque a obra como em andamento.'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.obras where id = v_id) then
    if coalesce((p ->> 'substituir')::boolean, false) then
      delete from public.obras where id = v_id;
    else
      raise exception 'Já existe uma obra com o código %. Escolha outro código ou confirme a substituição.', v_id
        using errcode = '23505';
    end if;
  end if;

  perform public.gravar_cadastros_da_carga(p);
  perform public.validar_carga(p, v_meses);

  insert into public.obras (id, nome, cliente, tipologia, cidade_id, area_m2, inicio, meses, data_base,
    situacao, prazo_previsto, grat_premios_pct, transf_pct, funcoes_transferidas, risco_pct, lucro_pct,
    trib_lucro_pct, provisionar, adiantamento, adiantamento_pct, rotatividade_pct,
    he_mix_util, he_mix_sabado, he_mix_intervalo, he_mix_feriado, carregada_por)
  select v_id, trim(x.nome), coalesce(x.cliente, ''), coalesce(x.tipologia, ''), nullif(x.cidade_id, ''),
    x.area_m2, x.inicio, x.meses, x.data_base, v_situacao, x.prazo_previsto,
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

  perform public.gravar_meses_da_carga(v_id, p);
  return v_id;
end;
$$;
revoke all on function public.gravar_carga_dados(jsonb) from public, anon, authenticated;

-- ── lançar mês na obra em andamento ─────────────────────────────────────────
-- Um mês por vez: o mês seguinte ao último lançado ou um já lançado (refazer substitui só aquele
-- mês). Premissas, trocas e feriados da obra ficam; rotatividade e mix de HE são recalculados
-- com todos os meses (são quantidades da folha).
create function public.lancar_mes_dados(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_id text := p ->> 'obra_id';
  v_mes integer := (p ->> 'mes_idx')::integer;
  ob public.obras;
  v_meses integer;
  he_tot numeric;
  he_sab numeric;
  he_int numeric;
  he_fer numeric;
begin
  perform public.exigir_carga();
  select * into ob from public.obras where id = v_id for update;
  if not found then
    raise exception 'Obra não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if ob.situacao <> 'andamento' then
    raise exception 'A obra % está concluída. Reabra a obra para lançar ou refazer um mês.', ob.nome
      using errcode = '22023';
  end if;
  if v_mes is null or v_mes < 0 or v_mes > ob.meses then
    raise exception 'Lance o mês seguinte ao último lançado ou refaça um mês já lançado.'
      using errcode = '22023';
  end if;
  if v_mes > 119 then
    raise exception 'A obra pode ter até 120 meses.' using errcode = '22023';
  end if;
  -- só o mês lançado
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'lancamentos', '[]')) l
             where (l ->> 'mes_idx')::integer <> v_mes)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'competencias', '[]')) c
             where (c ->> 'mes_idx')::integer <> v_mes)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'notas', '[]')) n
             where (n ->> 'mes_idx')::integer <> v_mes)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'erp', '[]')) e
             where (e ->> 'mes_idx')::integer <> v_mes)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'realocacoes', '[]')) r
             where (r ->> 'mes_ini')::integer <> v_mes or (r ->> 'mes_fim')::integer <> v_mes) then
    raise exception 'A folha traz outra competência além do mês lançado. Envie a folha só desse mês.'
      using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p -> 'lancamentos', '[]')) = 0 then
    raise exception 'A folha do mês está vazia. Envie a folha com as matrículas do mês.'
      using errcode = '22023';
  end if;

  perform public.gravar_cadastros_da_carga(p);
  v_meses := greatest(ob.meses, v_mes + 1);
  perform public.validar_carga(p, v_meses);

  -- refazer: tira só o mês (as rubricas e o efetivo vão junto)
  delete from public.lancamentos where obra_id = v_id and mes_idx = v_mes;
  delete from public.efetivo_mes where obra_id = v_id and mes_idx = v_mes;
  delete from public.competencias where obra_id = v_id and mes_idx = v_mes;
  delete from public.erp_realizado where obra_id = v_id and mes_idx = v_mes;
  delete from public.notas_fiscais where obra_id = v_id and mes_idx = v_mes;
  delete from public.realocacoes where obra_id = v_id and mes_ini = v_mes and mes_fim = v_mes;

  insert into public.obra_regime (obra_id, funcao_id, regime)
    select v_id, x.funcao_id, x.regime
    from jsonb_populate_recordset(null::public.obra_regime, coalesce(p -> 'regime', '[]')) x
    on conflict (obra_id, funcao_id) do update set regime = excluded.regime;

  update public.obras set meses = v_meses where id = v_id;
  perform public.gravar_meses_da_carga(v_id, p);

  -- rotatividade (inversa do §4.6, meses i ≥ 1) e mix de HE com todos os meses lançados
  update public.obras set rotatividade_pct = coalesce((
    select round(least(100, sum(least(admissoes, desligamentos))::numeric / nullif(sum(cabecas), 0) * 100), 4)
    from public.efetivo_mes where obra_id = v_id and mes_idx >= 1), 0)
  where id = v_id;

  select coalesce(sum(lr.referencia), 0),
    coalesce(sum(lr.referencia) filter (where r.tipo_he = 'sabado'), 0),
    coalesce(sum(lr.referencia) filter (where r.tipo_he = 'intervalo'), 0),
    coalesce(sum(lr.referencia) filter (where r.tipo_he = 'feriado'), 0)
  into he_tot, he_sab, he_int, he_fer
  from public.lancamento_rubricas lr
  join public.rubricas r on r.codigo = lr.rubrica_codigo and r.componente = 'he'
  join public.lancamentos l on (l.obra_id, l.mes_idx, l.matricula, l.funcao_id, l.construtora)
    = (lr.obra_id, lr.mes_idx, lr.matricula, lr.funcao_id, lr.construtora)
  join public.funcoes f on f.id = l.funcao_id
  where lr.obra_id = v_id and l.realocada_para is null and f.vinculo <> 'estagio';
  if he_tot > 0 then
    update public.obras set
      he_mix_sabado = round(he_sab / he_tot * 100, 4),
      he_mix_intervalo = round(he_int / he_tot * 100, 4),
      he_mix_feriado = round(he_fer / he_tot * 100, 4),
      he_mix_util = 100 - round(he_sab / he_tot * 100, 4) - round(he_int / he_tot * 100, 4)
        - round(he_fer / he_tot * 100, 4)
    where id = v_id;
  end if;
  return v_mes;
end;
$$;
revoke all on function public.lancar_mes_dados(jsonb) from public, anon, authenticated;

-- como a carga: a transação é marcada para a auditoria registrar só a obra (não as linhas do mês)
create function public.lancar_mes(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m integer;
begin
  perform set_config('ito.carga', 'on', true);
  m := public.lancar_mes_dados(p);
  perform set_config('ito.carga', '', true);
  return m;
end;
$$;
revoke all on function public.lancar_mes(jsonb) from public, anon;
grant execute on function public.lancar_mes(jsonb) to authenticated;

-- ── concluir e reabrir ──────────────────────────────────────────────────────
-- o período fecha no último mês lançado (meses = meses lançados)
create function public.definir_situacao_obra(p_id text, p_situacao public.situacao_obra)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ob public.obras;
begin
  perform public.exigir_carga();
  select * into ob from public.obras where id = p_id for update;
  if not found then
    raise exception 'Obra não encontrada. Atualize a página.' using errcode = 'P0002';
  end if;
  if p_situacao = 'concluida' and ob.meses < 1 then
    raise exception 'Lance ao menos um mês antes de concluir a obra.' using errcode = '22023';
  end if;
  update public.obras set situacao = p_situacao where id = p_id and situacao <> p_situacao;
end;
$$;
revoke all on function public.definir_situacao_obra(text, public.situacao_obra) from public, anon;
grant execute on function public.definir_situacao_obra(text, public.situacao_obra) to authenticated;
