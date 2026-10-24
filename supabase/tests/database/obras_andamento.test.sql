begin;
select plan(33);

-- M11: obra em andamento recebe a folha mês a mês; refazer substitui só o mês; concluir e reabrir
select has_column('public', 'obras', 'situacao', 'obras têm situação');
select hasnt_column('public', 'obras', 'fora_da_sede', 'sem "obra fora da sede" (decisão M11)');

create temp table m as select
  $j${"obra_id": "teste_andamento", "mes_idx": 0,
      "competencias": [{"mes_idx": 0, "he_media": 10}],
      "lancamentos": [
        {"mes_idx": 0, "matricula": "2001", "funcao_id": "ped", "equivalente": 1, "admitido": true,
         "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1500}, {"codigo": 200, "referencia": 30, "valor": 400}]},
        {"mes_idx": 0, "matricula": "2002", "funcao_id": "serv", "equivalente": 1,
         "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1100}]}]}$j$::jsonb as p0,
  $j${"obra_id": "teste_andamento", "mes_idx": 1,
      "competencias": [{"mes_idx": 1, "he_media": 12}],
      "lancamentos": [
        {"mes_idx": 1, "matricula": "2001", "funcao_id": "ped", "equivalente": 1,
         "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1500}, {"codigo": 201, "referencia": 10, "valor": 200}]},
        {"mes_idx": 1, "matricula": "2003", "funcao_id": "ped", "equivalente": 1, "admitido": true,
         "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1500}]},
        {"mes_idx": 1, "matricula": "2002", "funcao_id": "serv", "equivalente": 0.5, "desligado": true,
         "rubricas": [{"codigo": 1, "referencia": 110, "valor": 550}]}]}$j$::jsonb as p1;
grant select on m to authenticated;
set local role authenticated;

-- engenharia não começa nem lança
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.gravar_carga('{"obra": {"id": "teste_andamento", "nome": "Andamento", "area_m2": 1000,
  "inicio": "2026-01-01", "meses": 0, "data_base": 2025, "situacao": "andamento"}}')$$,
  '42501', null, 'engenharia não começa obra');

-- DP/RH começa a obra só com o cadastro
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$select public.gravar_carga('{"obra": {"id": "teste_vazia", "nome": "Vazia", "area_m2": 1000,
  "inicio": "2026-01-01", "meses": 0, "data_base": 2025}}')$$,
  '22023', null, 'obra concluída sem folha é recusada');
select is(public.gravar_carga('{"obra": {"id": "teste_andamento", "nome": "Andamento", "area_m2": 1000,
  "inicio": "2026-01-01", "meses": 0, "data_base": 2025, "situacao": "andamento", "prazo_previsto": 12}}'),
  'teste_andamento', 'obra em andamento começa sem folha');
select is((select row(situacao, meses, prazo_previsto)::text from public.obras where id = 'teste_andamento'),
  '(andamento,0,12)', 'em andamento, sem mês, prazo previsto 12');
select throws_ok($$select public.definir_situacao_obra('teste_andamento', 'concluida')$$, '22023', null,
  'sem mês lançado não conclui');

-- engenharia e diretoria não lançam nem concluem
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.lancar_mes((select p0 from m))$$, '42501', null, 'engenharia não lança mês');
select throws_ok($$select public.definir_situacao_obra('teste_andamento', 'concluida')$$, '42501', null,
  'engenharia não conclui');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.lancar_mes((select p0 from m))$$, '42501', null, 'diretoria não lança mês');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

-- mês a mês
select throws_ok($$select public.lancar_mes((select p1 from m))$$, '22023', null, 'não pula mês');
select is(public.lancar_mes((select p0 from m)), 0, 'lança o 1º mês');
select is(public.lancar_mes((select p1 || '{"feriados": [{"data": "2026-02-02", "nome": "Feriado municipal"}]}' from m)),
  1, 'lança o 2º mês');
select is((select count(*)::int from public.obra_feriados where obra_id = 'teste_andamento'), 1,
  'feriado municipal do ano do mês');
select throws_ok($$select public.lancar_mes((select p1 from m))$$, '22023', null,
  'lançar um mês que outra pessoa já lançou não vira refazer');
select is((select meses from public.obras where id = 'teste_andamento'), 2, 'período com 2 meses');
select is((select equivalente from public.efetivo_mes where obra_id = 'teste_andamento' and funcao_id = 'ped' and mes_idx = 1),
  2::numeric, 'pessoa-mês do pedreiro no 2º mês');
select is((select he_mix_sabado from public.obras where id = 'teste_andamento'), 25::numeric,
  'mix de HE com os dois meses: 10 h de sábado em 40 h');
select is((select rotatividade_pct from public.obras where id = 'teste_andamento'), 0::numeric,
  'rotatividade: admissão e desligamento em funções diferentes');
select throws_ok($$select public.lancar_mes((select p1 || '{"mes_idx": 2}' from m))$$, '22023', null,
  'folha com outra competência é recusada');
select throws_ok($$select public.lancar_mes('{"obra_id": "teste_andamento", "mes_idx": 2, "lancamentos": []}')$$,
  '22023', null, 'mês sem folha é recusado');

-- premissa editada fica; refazer o 1º mês substitui só ele
update public.obras set grat_premios_pct = 7 where id = 'teste_andamento';
select is(public.lancar_mes(jsonb_set((select p0 || '{"refazer": true}' from m), '{lancamentos}',
  '[{"mes_idx": 0, "matricula": "2001", "funcao_id": "ped", "equivalente": 0.5,
     "rubricas": [{"codigo": 1, "referencia": 110, "valor": 750}]}]')), 0, 'refaz o 1º mês');
select is((select count(*)::int from public.lancamentos where obra_id = 'teste_andamento' and mes_idx = 0), 1,
  '1º mês só com o lançamento novo');
select is((select count(*)::int from public.lancamentos where obra_id = 'teste_andamento' and mes_idx = 1), 3,
  '2º mês intacto');
select is((select count(*)::int from public.efetivo_mes where obra_id = 'teste_andamento' and mes_idx = 0), 1,
  'efetivo do 1º mês refeito (sem o servente)');
select is((select row(meses, grat_premios_pct)::text from public.obras where id = 'teste_andamento'), '(2,7.0000)',
  'período e premissa editada ficam');
select is((select he_mix_sabado from public.obras where id = 'teste_andamento'), 100::numeric,
  'mix recalculado sem a HE útil do mês refeito');

-- concluir fecha no último mês lançado; concluída não recebe mês; reabrir volta a receber
select lives_ok($$select public.definir_situacao_obra('teste_andamento', 'concluida')$$, 'conclui');
select throws_ok($$select public.lancar_mes((select p1 from m))$$, '22023', null, 'concluída não recebe mês');
select lives_ok($$select public.definir_situacao_obra('teste_andamento', 'andamento')$$, 'reabre');
select is(public.lancar_mes((select p1 || '{"refazer": true}' from m)), 1, 'reaberta, refaz o último mês');

-- realocação de vários meses (carga inteira): refazer o mês do meio parte o período
reset role;
insert into public.realocacoes (obra_id, tipo, funcao_id, mes_ini, mes_fim, qtd, outra_obra, saldo_vt)
  values ('teste_andamento', 'cedida', 'serv', 0, 2, 1, 'Obra B', 90);
update public.obras set meses = 3 where id = 'teste_andamento';
set local role authenticated;
select is(public.lancar_mes((select p1 || '{"refazer": true}' from m)), 1, 'refaz o mês do meio');
select is((select string_agg(mes_ini || '-' || mes_fim || ':' || saldo_vt, ' ' order by mes_ini)
  from public.realocacoes where obra_id = 'teste_andamento'), '0-0:90.00 2-2:0.00',
  'a realocação de 3 meses perde só o mês refeito');

select * from finish();
rollback;
