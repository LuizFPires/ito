begin;
select plan(10);

-- obra mínima gravada pela carga (DP/RH)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(public.gravar_carga($j${
  "obra": {"id": "consulta", "nome": "Obra Consulta", "area_m2": 1000, "inicio": "2025-03-01", "meses": 2,
           "data_base": 2025},
  "competencias": [{"mes_idx": 0, "absenteismo_pct": 3}, {"mes_idx": 1, "absenteismo_pct": 4}],
  "lancamentos": [{"mes_idx": 0, "matricula": "1", "funcao_id": "ped", "equivalente": 1}]}$j$::jsonb),
  'consulta', 'obra gravada');

-- resumo em cache: quem carrega grava
select is(public.gravar_resumos('[{"obra_id": "consulta", "vigente": 2026, "pico": 1, "pessoa_mes": 1,
  "he_por_pessoa": 0, "indireta_pct": 0, "custo_epoca": 1000, "custo_atual": 1100, "histograma": [1, 0]}]'),
  1, 'DP/RH grava o resumo');
select is((select custo_atual from public.obra_resumo where obra_id = 'consulta'), 1100.00, 'resumo lido');

-- editar premissa e ausência: quem carrega
update public.obras set grat_premios_pct = 5 where id = 'consulta';
select is((select grat_premios_pct from public.obras where id = 'consulta'), 5.0000, 'DP/RH edita premissa');
select is((select versao from public.obra_resumo where obra_id = 'consulta'), 0, 'editar a obra invalida o resumo');
update public.competencias set absenteismo_pct = 7 where obra_id = 'consulta' and mes_idx = 1;
select is((select absenteismo_pct from public.competencias where obra_id = 'consulta' and mes_idx = 1),
  7.0000, 'DP/RH edita ausência do mês');
select throws_ok($$update public.obras set area_m2 = 1 where id = 'consulta'$$, '42501', null,
  'área não é editável (só pela carga)');

-- engenharia: só lê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
update public.obras set grat_premios_pct = 9 where id = 'consulta';
select is((select grat_premios_pct from public.obras where id = 'consulta'), 5.0000, 'engenharia não edita premissa');
select throws_ok($$select public.gravar_resumos('[]')$$, '42501', null, 'engenharia não grava resumo');
select is((select count(*)::int from public.obra_resumo), 1, 'engenharia lê o resumo');

select * from finish();
rollback;
