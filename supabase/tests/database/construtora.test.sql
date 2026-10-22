begin;
select plan(5);

-- M9: a mesma obra com gente fichada na Clássica e na Ampla (mesma matrícula nas duas)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(public.gravar_carga($j${
  "obra": {"id": "duas", "nome": "Obra Duas Construtoras", "area_m2": 1000, "inicio": "2025-03-01",
           "meses": 1, "data_base": 2025},
  "competencias": [{"mes_idx": 0}],
  "lancamentos": [
    {"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1,
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1650}]},
    {"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1, "construtora": "ampla",
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1700}]}]}$j$::jsonb),
  'duas', 'a mesma matrícula nas duas construtoras é gravada');

select is((select count(*)::integer from public.lancamentos where obra_id = 'duas'), 2, 'dois lançamentos');
select is((select construtora::text from public.lancamento_rubricas where obra_id = 'duas' and valor = 1700),
  'ampla', 'rubrica guarda a construtora do lançamento');
select is((select cabecas from public.efetivo_mes where obra_id = 'duas'), 2,
  'cabeças contam a matrícula em cada construtora');
select is((select count(*)::integer from public.lancamentos
           where obra_id = 'duas' and construtora = 'classica'), 1, 'sem construtora informada = Clássica');

select * from finish();
rollback;
