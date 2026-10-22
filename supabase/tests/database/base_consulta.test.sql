begin;
select plan(20);

-- obra mínima gravada pela carga (DP/RH)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(public.gravar_carga($j${
  "obra": {"id": "consulta", "nome": "Obra Consulta", "area_m2": 1000, "inicio": "2025-03-01", "meses": 2,
           "data_base": 2025},
  "competencias": [{"mes_idx": 0, "absenteismo_pct": 3}, {"mes_idx": 1, "absenteismo_pct": 4}],
  "lancamentos": [{"mes_idx": 0, "matricula": "1", "funcao_id": "ped", "equivalente": 1}]}$j$::jsonb),
  'consulta', 'obra gravada');

create temp table resumo_base on commit drop as select '{"vigente": 2026, "contexto": "abc", "pico": 1,
  "pessoa_mes": 1, "he_por_pessoa": 0, "indireta_pct": 0, "custo_epoca": 1000, "custo_atual": 1100,
  "histograma": [1, 0]}'::jsonb as r;
create function pg_temp.resumo(rev integer) returns jsonb language sql as $$
  select jsonb_build_array((select r from resumo_base) || jsonb_build_object('obra_id', 'consulta', 'revisao', rev))
$$;

-- resumo em cache: quem carrega grava, se calculado sobre a revisão atual
select is(public.gravar_resumos(pg_temp.resumo((select revisao from public.obras where id = 'consulta'))),
  1, 'DP/RH grava o resumo da revisão atual');
select is(public.gravar_resumos(pg_temp.resumo((select revisao from public.obras where id = 'consulta') - 1)),
  0, 'resumo calculado sobre revisão velha não é gravado');
select is((select custo_atual from public.obra_resumo where obra_id = 'consulta'), 1100.00, 'resumo lido');
select is((select contexto from public.obra_resumo where obra_id = 'consulta'), 'abc', 'impressão dos parâmetros');
select throws_ok($$select public.gravar_resumos(pg_temp.resumo((select revisao from public.obras where id = 'consulta')) #- '{0,pico}' || '[]')$$,
  '23502', null, 'resumo sem pico é recusado');

-- editar premissa e ausência: quem carrega; invalida o resumo e muda a revisão
create temp table rev0 on commit drop as select revisao from public.obras where id = 'consulta';
grant select on rev0 to authenticated;
update public.obras set grat_premios_pct = 5 where id = 'consulta';
select is((select grat_premios_pct from public.obras where id = 'consulta'), 5.0000, 'DP/RH edita premissa');
select is((select versao from public.obra_resumo where obra_id = 'consulta'), 0, 'editar a obra invalida o resumo');
select ok((select revisao from public.obras where id = 'consulta') > (select revisao from rev0), 'nova revisão');
update public.competencias set absenteismo_pct = 7 where obra_id = 'consulta' and mes_idx = 1;
select is((select absenteismo_pct from public.competencias where obra_id = 'consulta' and mes_idx = 1),
  7.0000, 'DP/RH edita ausência do mês');
select throws_ok($$update public.obras set area_m2 = 1 where id = 'consulta'$$, '42501', null,
  'área não é editável (só pela carga)');
select throws_ok($$insert into public.obra_trocas_tabela (obra_id, mes_idx, data_base) values ('consulta', 9, 2024)$$,
  '22023', null, 'troca fora do período é recusada');
select throws_ok($$update public.obras set funcoes_transferidas = '{nao_existe}' where id = 'consulta'$$,
  '23503', null, 'função transferida sem cadastro é recusada');
insert into public.obra_regime (obra_id, funcao_id, regime) values ('consulta', 'ped', 'sp');
select is((select count(*)::int from public.obra_regime where obra_id = 'consulta'), 1, 'DP/RH marca S/P');

-- engenharia: só lê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
update public.obras set grat_premios_pct = 9 where id = 'consulta';
select is((select grat_premios_pct from public.obras where id = 'consulta'), 5.0000, 'engenharia não edita premissa');
update public.competencias set absenteismo_pct = 50 where obra_id = 'consulta';
select is((select max(absenteismo_pct) from public.competencias where obra_id = 'consulta'), 7.0000,
  'engenharia não edita ausência');
select throws_ok($$insert into public.obra_feriados (obra_id, data, nome) values ('consulta', '2025-04-21', 'x')$$,
  '42501', null, 'engenharia não inclui feriado');
delete from public.obra_regime where obra_id = 'consulta';
select is((select count(*)::int from public.obra_regime where obra_id = 'consulta'), 1, 'engenharia não tira S/P');
select throws_ok($$select public.gravar_resumos('[]')$$, '42501', null, 'engenharia não grava resumo');
select is((select count(*)::int from public.obra_resumo), 1, 'engenharia lê o resumo');

select * from finish();
rollback;
