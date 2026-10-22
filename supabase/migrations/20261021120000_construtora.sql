-- M9 — Construtora de cada lançamento (decisão do usuário): Ampla e Clássica são construtoras do
-- mesmo grupo e, numa mesma obra, há gente fichada em cada uma. A obra é uma só; cada lançamento
-- guarda a construtora, que entra na chave (a mesma matrícula pode existir nas duas).

create type public.construtora as enum ('classica', 'ampla');
comment on type public.construtora is 'Construtora em que a pessoa estava fichada (mesmo grupo).';

alter table public.lancamento_rubricas
  drop constraint lancamento_rubricas_obra_id_mes_idx_matricula_funcao_id_fkey;
alter table public.lancamento_rubricas drop constraint lancamento_rubricas_pkey;
alter table public.lancamentos drop constraint lancamentos_pkey;

alter table public.lancamentos
  add column construtora public.construtora not null default 'classica';
alter table public.lancamento_rubricas
  add column construtora public.construtora not null default 'classica';

alter table public.lancamentos
  add primary key (obra_id, mes_idx, matricula, funcao_id, construtora);
alter table public.lancamento_rubricas
  add primary key (obra_id, mes_idx, matricula, funcao_id, construtora, rubrica_codigo);
alter table public.lancamento_rubricas
  add constraint lancamento_rubricas_lancamento_fkey
  foreign key (obra_id, mes_idx, matricula, funcao_id, construtora)
  references public.lancamentos (obra_id, mes_idx, matricula, funcao_id, construtora) on delete cascade;

create or replace function public.gravar_carga(p jsonb)
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
  select string_agg(distinct x, ', ') into faltando
    from jsonb_array_elements_text(coalesce(o -> 'funcoes_transferidas', '[]')) x
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
  group by funcao_id, mes_idx;

  insert into public.realocacoes (obra_id, tipo, funcao_id, mes_ini, mes_fim, qtd, outra_obra, outra_obra_id, saldo_vt)
  select v_id, x.tipo, x.funcao_id, x.mes_ini, x.mes_fim, x.qtd, x.outra_obra, nullif(x.outra_obra_id, ''),
    coalesce(x.saldo_vt, 0)
  from jsonb_populate_recordset(null::public.realocacoes, coalesce(p -> 'realocacoes', '[]')) x;

  insert into public.notas_fiscais (obra_id, prestador_cnpj, numero, mes_idx, valor, iss, pis, cofins, inss, ir, csll)
  select v_id, x.prestador_cnpj, x.numero, x.mes_idx, x.valor, coalesce(x.iss, 0), coalesce(x.pis, 0),
    coalesce(x.cofins, 0), coalesce(x.inss, 0), coalesce(x.ir, 0), coalesce(x.csll, 0)
  from jsonb_populate_recordset(null::public.notas_fiscais, coalesce(p -> 'notas', '[]')) x;

  return v_id;
end;
$$;
