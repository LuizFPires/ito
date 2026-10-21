begin;
select plan(29);

-- Estrutura e privacidade (regra 2): só matrícula
select has_table('public', 'obras', 'tabela obras');
select has_table('public', 'lancamentos', 'tabela lancamentos');
select hasnt_column('public', 'lancamentos', 'nome', 'lançamento sem nome');
select hasnt_column('public', 'lancamentos', 'cpf', 'lançamento sem CPF');
select is((select relrowsecurity from pg_class where oid = 'public.lancamento_rubricas'::regclass), true,
  'RLS ligada nas rubricas do lançamento');
select is((select tipo_he from public.rubricas where codigo = 201), 'sabado', 'rubrica 201 = HE de sábado');

-- carga mínima: 2 meses, pedreiro e servente, uma matrícula realocada
create temp table carga as select $j${
  "obra": {"id": "teste_carga", "nome": "Obra Teste", "area_m2": 2000, "inicio": "2025-03-01",
           "meses": 2, "data_base": 2025, "he_mix_util": 70, "he_mix_sabado": 15,
           "he_mix_intervalo": 5, "he_mix_feriado": 10},
  "sinonimos": [{"texto": "pedreiro de acabamento", "funcao_id": "ped"}],
  "competencias": [{"mes_idx": 0, "he_media": 10, "erp_realizado": 1000, "ito_apropriado": 1000},
                   {"mes_idx": 1, "he_media": 12}],
  "lancamentos": [
    {"mes_idx": 0, "matricula": "1001", "funcao_id": "ped", "equivalente": 1, "admitido": true,
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1500}, {"codigo": 200, "referencia": 10, "valor": 136.36}]},
    {"mes_idx": 0, "matricula": "1002", "funcao_id": "ped", "equivalente": 0.5,
     "rubricas": [{"codigo": 1, "referencia": 110, "valor": 750}]},
    {"mes_idx": 0, "matricula": "1003", "funcao_id": "serv", "equivalente": 1, "realocada_para": "Outra obra",
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1100}]},
    {"mes_idx": 1, "matricula": "1001", "funcao_id": "ped", "equivalente": 1, "desligado": true,
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1500}]}
  ]}$j$::jsonb as p;

-- Anônimo e perfis só de leitura não gravam
set local role anon;
select throws_ok($$select public.gravar_carga((select p from carga))$$, '42501', null, 'anônimo não grava');
reset role;
grant select on carga to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.gravar_carga((select p from carga))$$, '42501', null, 'engenharia não grava');
select throws_ok($$insert into public.obras (id, nome, area_m2, inicio, meses, data_base)
  values ('x', 'x', 1, '2025-01-01', 1, 2025)$$, '42501', null, 'ninguém grava direto na tabela');

-- DP/RH grava
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(public.gravar_carga((select p from carga)), 'teste_carga', 'DP/RH grava a carga');
select is((select count(*)::int from public.lancamentos where obra_id = 'teste_carga'), 4, '4 lançamentos');
select is((select count(*)::int from public.lancamento_rubricas where obra_id = 'teste_carga'), 5, '5 rubricas');
select is((select equivalente from public.efetivo_mes where obra_id = 'teste_carga' and funcao_id = 'ped' and mes_idx = 0),
  1.5::numeric, 'pessoa-mês do pedreiro em mar = 1 + 0,5');
select is((select cabecas from public.efetivo_mes where obra_id = 'teste_carga' and funcao_id = 'ped' and mes_idx = 0),
  2, 'cabeças do pedreiro em mar = 2');
select is((select admissoes + desligamentos from public.efetivo_mes
  where obra_id = 'teste_carga' and funcao_id = 'ped' and mes_idx = 1), 1, 'desligamento em abr');
select is((select count(*)::int from public.efetivo_mes where obra_id = 'teste_carga' and funcao_id = 'serv'), 0,
  'MDO realocada fica fora do efetivo');
select is((select funcao_id from public.funcao_sinonimos where texto = 'PEDREIRO DE ACABAMENTO'), 'ped',
  'sinônimo gravado em caixa alta');
select is((select carregada_por::text from public.obras where id = 'teste_carga'),
  '00000000-0000-4000-8000-000000000004', 'carimbo de quem carregou');

select is((select obras from public.funcao_obras where funcao_id = 'ped'), 1, 'Funções: pedreiro em 1 obra');

-- Repetir sem confirmar a substituição é recusado; com confirmação, substitui
select throws_ok($$select public.gravar_carga((select p from carga))$$, '23505', null, 'código repetido pede confirmação');
select is(public.gravar_carga((select p || '{"substituir": true}'::jsonb from carga)), 'teste_carga', 'substitui');
select is((select count(*)::int from public.lancamentos where obra_id = 'teste_carga'), 4, 'sem duplicar');

-- Pendências bloqueantes
select throws_ok($$select public.gravar_carga(jsonb_set((select p from carga), '{obra,id}', '"outra"')
  || '{"lancamentos": [{"mes_idx": 0, "matricula": "9", "funcao_id": "inexistente", "equivalente": 1}]}')$$,
  '23503', null, 'função sem mapeamento bloqueia');
select throws_ok($$select public.gravar_carga(jsonb_set((select p from carga), '{obra,id}', '"outra"')
  || '{"lancamentos": [{"mes_idx": 0, "matricula": "9", "funcao_id": "ped", "equivalente": 1,
       "rubricas": [{"codigo": 77777, "valor": 1}]}]}')$$,
  '23503', null, 'rubrica sem classificação bloqueia');
select throws_ok($$select public.gravar_carga(jsonb_set((select p from carga), '{obra,id}', '"outra"')
  || '{"notas": [{"prestador_cnpj": "12345678000199", "numero": "412", "valor": 100}]}')$$,
  '23502', null, 'NF sem competência bloqueia');
select throws_ok($$select public.gravar_carga(jsonb_set((select p from carga), '{obra,id}', '"outra"')
  || '{"competencias": [{"mes_idx": 0, "erp_realizado": 2000, "ito_apropriado": 1000}]}')$$,
  '23502', null, 'diferença com o ERP sem justificativa bloqueia');

-- Rascunho: cada um vê o seu
insert into public.carga_rascunhos (titulo, dados) values ('meu', '{}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.carga_rascunhos), 0, 'planejamento não vê rascunho alheio');
select throws_ok($$insert into public.carga_rascunhos (titulo) values ('x')$$, '42501', null,
  'planejamento não cria rascunho');

-- Excluir a obra: só quem carrega
select throws_ok($$select public.excluir_obra('teste_carga')$$, '42501', null, 'planejamento não exclui obra');

select * from finish();
rollback;
