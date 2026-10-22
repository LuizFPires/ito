begin;
select plan(23);

-- Dados mínimos (como postgres)
insert into public.ccts (id, nome, mes_data_base) values ('t_cct', 'CCT teste', 5);
insert into public.cct_salarios values ('t_cct', 'ped', 1500);
insert into public.cct_gratificacoes values ('t_cct', 'mestre', 600);
insert into public.cidades (id, nome, uf, cct_id, tarifa_local) values ('t_a', 'Cidade A', 'MG', 't_cct', 5);
insert into public.cidades (id, nome, uf, cct_id, tarifa_local) values ('t_b', 'Cidade B', 'MG', 't_cct', 6);

select ok((select relrowsecurity from pg_class where oid = 'public.cidades'::regclass), 'RLS em cidades');

set local role anon;
select throws_ok('select * from public.ccts', '42501', null, 'anônimo não lê CCTs');
reset role;

-- DP/RH e planejamento: só leem
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select ok((select count(*) from public.cidades) >= 2, 'DP/RH lê cidades');
update public.cidades set tarifa_local = 1 where id = 't_a';
select is((select tarifa_local from public.cidades where id = 't_a'), 5.00::numeric, 'DP/RH não altera cidade');
select throws_ok($$select public.ajustar_cct('t_cct', 5)$$, '42501', null, 'DP/RH não ajusta CCT');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$insert into public.ccts (id, nome) values ('x', 'X')$$, '42501', null, 'planejamento não cria CCT');

-- Controladoria (admin do seed)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.criar_cct('t_nova', ' Nova CCT '), 't_nova', 'cria CCT');
select is((select valor from public.cct_salarios where cct_id = 't_nova' and funcao_id = 'ped'), 1400.00::numeric,
  'nova CCT nasce com o salário da vigente');
select is((select count(*)::int from public.cct_gratificacoes where cct_id = 't_nova'), 0, 'sem gratificações');
select is((select mes_data_base from public.ccts where id = 't_nova'), 5, 'data-base em maio');

select is(public.duplicar_cct('t_cct', 't_dup', 'CCT teste (cópia)'), 't_dup', 'duplica');
select is((select valor from public.cct_gratificacoes where cct_id = 't_dup' and funcao_id = 'mestre'), 600.00::numeric,
  'cópia leva gratificações');
select is((select count(*)::int from public.cidades where cct_id = 't_dup'), 0, 'cópia não leva cidades');

-- t_cct só tem o pedreiro; as demais funções ativas (13) usam a empresa e entram ajustadas
select is(public.ajustar_cct('t_cct', 6), 14, 'ajuste em lote conta próprias + da empresa');
select is((select valor from public.cct_salarios where cct_id = 't_cct' and funcao_id = 'serv'), 1176.60::numeric,
  'função que usava a empresa entra ajustada (1.110 → 1.176,60)');
select is((select valor from public.cct_gratificacoes where cct_id = 't_cct' and funcao_id = 'mestre'), 636.00::numeric,
  'gratificação ajustada (600 → 636)');
select isnt((select atualizado_por from public.ccts where id = 't_cct'), null, 'ajuste carimba a CCT');
select throws_ok($$select public.ajustar_cct('nao_existe', 5)$$, '23503', null, 'CCT inexistente é erro');
select is((select valor from public.cct_salarios where cct_id = 't_cct' and funcao_id = 'ped'), 1590.00::numeric,
  'salário +6% (1.500 → 1.590)');

select throws_ok($$delete from public.ccts where id = 't_cct'$$, '23503', null, 'CCT com cidades não é excluída');

-- Regras de dados
reset role;
select throws_ok($$insert into public.cidade_feriados values ('t_a', 4, 31, 'Não existe')$$, '22008', null,
  '31/04 é recusado');
select throws_ok($$insert into public.cidade_passagens values ('t_a', 't_a', 5)$$, '23514', null,
  'passagem para a própria cidade é recusada');
insert into public.cidade_passagens values ('t_a', 't_b', 9);
select throws_ok($$delete from public.cidades where id = 't_b'$$, '23503', null,
  'cidade que é origem de passagem não é apagada');

select * from finish();
rollback;
