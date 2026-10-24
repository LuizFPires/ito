-- Revisão do M11.
-- 1. Lançar mês diz a intenção (lançar o próximo ou refazer): se outra pessoa lançou o mês no
--    meio, "lançar" não vira "refazer" calado.
-- 2. Refazer um mês parte as realocações de vários meses (vindas da carga inteira ou de obra
--    reaberta): o mês sai do período delas e entra só o que a folha nova traz.

create or replace function public.lancar_mes_dados(p jsonb)
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
  if coalesce((p ->> 'refazer')::boolean, false) <> (v_mes < ob.meses) then
    raise exception 'Outra pessoa lançou um mês desta obra enquanto você preparava este lançamento. Atualize a página e confira o mês.'
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
  -- realocação que passa pelo mês: parte em duas (o saldo de VT fica na primeira parte)
  insert into public.realocacoes (obra_id, tipo, funcao_id, mes_ini, mes_fim, qtd, outra_obra, outra_obra_id, saldo_vt)
    select obra_id, tipo, funcao_id, v_mes + 1, mes_fim, qtd, outra_obra, outra_obra_id, 0
    from public.realocacoes where obra_id = v_id and mes_ini < v_mes and mes_fim > v_mes;
  update public.realocacoes set mes_fim = v_mes - 1
    where obra_id = v_id and mes_ini < v_mes and mes_fim >= v_mes;
  update public.realocacoes set mes_ini = v_mes + 1
    where obra_id = v_id and mes_ini = v_mes and mes_fim > v_mes;

  insert into public.obra_regime (obra_id, funcao_id, regime)
    select v_id, x.funcao_id, x.regime
    from jsonb_populate_recordset(null::public.obra_regime, coalesce(p -> 'regime', '[]')) x
    on conflict (obra_id, funcao_id) do update set regime = excluded.regime;
  -- feriados municipais do ano do mês (a obra em andamento entra em anos novos)
  insert into public.obra_feriados (obra_id, data, nome)
    select v_id, x.data, x.nome
    from jsonb_populate_recordset(null::public.obra_feriados, coalesce(p -> 'feriados', '[]')) x
    on conflict (obra_id, data) do nothing;

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
