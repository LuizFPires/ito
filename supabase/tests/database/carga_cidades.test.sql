begin;
select plan(7);

select ok((select count(*) from public.ccts where id in ('bh', 'noroeste', 'araxa')) = 3, 'CCTs da carga');
select ok((select count(*) from public.cidades) >= 16, '16 cidades da carga');
-- Dados dos golden do SPEC §8 (reajuste automático e VT por origem)
select is((select cct_id from public.cidades where id = 'vespasiano'), 'bh', 'Vespasiano usa a CCT de BH');
select is((select row(mes_data_base, reajuste_estimado_pct)::text from public.ccts where id = 'bh'),
  '(5,6.0000)', 'CCT BH: data-base maio, reajuste 6%');
select is((select valor from public.cct_salarios where cct_id = 'bh' and funcao_id = 'ped'), 1400.00::numeric,
  'pedreiro na CCT BH = 1.400');
select is((select tarifa_local * conducoes * 2 from public.cidades where id = 'vespasiano'), 11.00::numeric,
  'VT local Vespasiano = 11,00');
select is((select valor * 2 from public.cidade_passagens where cidade_id = 'vespasiano' and origem_id = 'bh'),
  24.80::numeric, 'VT vindo de BH = 24,80');

select * from finish();
rollback;
