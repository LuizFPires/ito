begin;
select plan(9);

select is((select count(*)::int from public.funcoes), 14, '14 funções (13 do SPEC + estagiário)');
select is((select vinculo::text from public.funcoes where id = 'estag'), 'estagio', 'estagiário com vínculo estágio');
select is((select count(*)::int from public.rubricas), 38, 'rubricas de referência');
select is((select funcao_id from public.funcao_sinonimos where texto = 'MEIO OFICIAL PEDREIRO'), 'ped', 'sinônimo da folha');
select is((select array_agg(ano order by ano) from public.datas_base), array[2023, 2024, 2025, 2026], 'datas-base 2023 a 2026');
select is((select data_base_vigente from public.parametros), 2026, 'vigente 2026');
select is((select valor from public.data_base_salarios where ano = 2026 and funcao_id = 'ped'), 1400.00::numeric,
  'pedreiro 2026 = 1.400 (golden de reajuste)');

-- Golden SPEC §8 a partir das linhas gravadas: sociais CLT 43,96% e provisões 22,64%
with e as (select * from public.data_base_encargos where ano = 2026),
     soc as (select sum(base_calc_pct / 100 * aliq_clt) v from e where grupo = 'soc'),
     fer as (select sum(base_calc_pct / 100 * aliq_clt) v from e where id in ('ferias', 'terco', 'dec'))
select is(round((select v from soc) * (1 + (select v from fer) / 100), 2), 43.96::numeric, 'encargos sociais 43,96%');
select is(round((select sum(base_calc_pct / 100 * aliq_clt) from public.data_base_encargos
                 where ano = 2026 and grupo = 'prov'), 2), 22.64::numeric, 'provisões 22,64%');

select * from finish();
rollback;
