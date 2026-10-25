begin;
select plan(7);

-- M14: métricas de tela sem dado pessoal; quem está ativo grava, só o administrador lê
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000ff","role":"authenticated"}', true);
select throws_ok($$select public.registrar_metricas('[{"tipo":"tempo","nome":"x","valor":1}]')$$,
  '42501', null, 'sem cadastro ativo não grava');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.registrar_metricas($$[
  {"tipo":"tempo","nome":"abrir histograma","valor":420,"rota":"/projecoes/nova","versao":"abc1234"},
  {"tipo":"vital","nome":"LCP","valor":900},
  {"tipo":"erro","nome":"tela","detalhe":"x is undefined @ a.js:1"},
  {"tipo":"outro","nome":"ignorado","valor":1},
  {"tipo":"tempo","nome":"negativo","valor":-5}
]$$), 3, 'grava as válidas e descarta as fora do formato');
select throws_ok($$select public.registrar_metricas((select json_agg(json_build_object('tipo','tempo','nome','x','valor',1)) from generate_series(1, 51)))$$,
  '22023', null, 'no máximo 50 por lote');
select throws_ok($$select * from public.resumo_metricas(7)$$, '42501', null, 'planejamento não lê o desempenho');
select throws_ok($$select count(*) from public.metricas_tela$$, '42501', null, 'a tabela não é lida pela API');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select p50 from public.resumo_metricas(7) where nome = 'abrir histograma'), 420.000,
  'administrador vê a mediana');
select is((select vezes::int from public.erros_tela(7) where detalhe like 'x is undefined%'), 1,
  'administrador vê os erros agrupados');

select * from finish();
rollback;
