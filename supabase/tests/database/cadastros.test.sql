begin;
select plan(22);

-- Dados mínimos (como postgres)
insert into public.funcoes (id, nome, grupo) values ('teste_f', 'Função teste', 'direta')
  on conflict (id) do nothing;
insert into public.rubricas (codigo, nome, tipo, componente) values (99001, 'RUBRICA TESTE', 'provento', 'sal')
  on conflict (codigo) do nothing;
insert into public.beneficios (id, nome) values ('teste_b', 'Benefício teste') on conflict (id) do nothing;
insert into public.datas_base (ano, salario_minimo) values (2090, 1000) on conflict (ano) do nothing;
insert into public.data_base_salarios (ano, funcao_id, valor) values (2090, 'teste_f', 1400)
  on conflict (ano, funcao_id) do update set valor = 1400;
insert into public.data_base_beneficios (ano, beneficio_id, valor) values (2090, 'teste_b', 100)
  on conflict (ano, beneficio_id) do update set valor = 100;
insert into public.data_base_encargos (ano, id, grupo, nome, aliq_clt) values (2090, 'inss', 'soc', 'INSS', 20)
  on conflict (ano, id) do nothing;

select ok((select relrowsecurity from pg_class where oid = 'public.funcoes'::regclass), 'RLS em funcoes');
select ok((select relrowsecurity from pg_class where oid = 'public.data_base_encargos'::regclass), 'RLS em encargos');

-- Anônimo não lê
set local role anon;
select throws_ok('select * from public.funcoes', '42501', null, 'anônimo não lê funções');
select throws_ok('select * from public.datas_base', '42501', null, 'anônimo não lê datas-base');
reset role;

-- Engenharia: lê, não edita nada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select ok((select count(*) from public.funcoes) > 0, 'engenharia lê funções');
select throws_ok($$insert into public.funcoes (id, nome, grupo) values ('x1', 'X1', 'direta')$$,
  '42501', null, 'engenharia não cria função');
update public.funcoes set nome = 'Hack' where id = 'teste_f';
select is((select nome from public.funcoes where id = 'teste_f'), 'Função teste', 'engenharia não altera função');
update public.data_base_salarios set valor = 1 where ano = 2090;
select is((select valor from public.data_base_salarios where ano = 2090 and funcao_id = 'teste_f'), 1400.00::numeric,
  'engenharia não altera salário');
select throws_ok($$select public.criar_data_base(2091, 2090, 5)$$, '42501', null,
  'engenharia não cria data-base');

-- DP/RH: edita funções e rubricas, não parâmetros
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
update public.funcoes set ferramentas_mes = 75 where id = 'teste_f';
select is((select ferramentas_mes from public.funcoes where id = 'teste_f'), 75.00::numeric, 'DP/RH altera função');
insert into public.funcao_sinonimos (texto, funcao_id) values ('FUNCAO TESTE', 'teste_f');
select is((select funcao_id from public.funcao_sinonimos where texto = 'FUNCAO TESTE'), 'teste_f', 'DP/RH cria sinônimo');
update public.rubricas set base_provisoes = true where codigo = 99001;
select is((select base_provisoes from public.rubricas where codigo = 99001), true, 'DP/RH classifica rubrica');
update public.datas_base set salario_minimo = 1 where ano = 2090;
select is((select salario_minimo from public.datas_base where ano = 2090), 1000.00::numeric,
  'DP/RH não altera tabela da empresa');
select throws_ok($$insert into public.feriados_empresa (data, nome) values ('2090-12-24', 'X')$$,
  '42501', null, 'DP/RH não cria feriado da empresa');
select is((select atualizado_por::text from public.funcoes where id = 'teste_f'),
  '00000000-0000-4000-8000-000000000004', 'carimbo de quem alterou');

-- Controladoria (admin do seed): cria data-base com reajuste
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.criar_data_base(2091, 2090, 6), 2091, 'controladoria cria data-base');
select is((select valor from public.data_base_salarios where ano = 2091 and funcao_id = 'teste_f'), 1484.00::numeric,
  'salário reajustado 6% (1.400 → 1.484)');
select is((select valor from public.data_base_beneficios where ano = 2091 and beneficio_id = 'teste_b'), 106.00::numeric,
  'benefício reajustado');
select is((select aliq_clt from public.data_base_encargos where ano = 2091 and id = 'inss'), 20.0000::numeric,
  'encargos copiados sem reajuste');
select is((select a_revisar from public.datas_base where ano = 2091), true, 'nova data-base nasce a revisar');
select throws_ok($$select public.criar_data_base(2091, 2090, 6)$$, '23505', null, 'ano repetido é recusado');

-- Validação de dados
reset role;
select throws_ok($$insert into public.funcao_sinonimos (texto, funcao_id) values ('minusculo', 'teste_f')$$,
  '23514', null, 'sinônimo precisa estar em caixa alta');

select * from finish();
rollback;
