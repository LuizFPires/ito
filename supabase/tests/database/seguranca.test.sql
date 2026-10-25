begin;
select plan(22);

-- S01: perda do perfil de carga revoga rascunhos (dados por matrícula)
insert into public.carga_rascunhos (id, usuario_id, titulo, etapa, dados)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000004', 'Rascunho S01', 1, '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.carga_rascunhos where titulo = 'Rascunho S01'), 1, 'DP/RH lê o próprio rascunho');
reset role;
update public.usuarios set perfil = 'engenharia' where id = '00000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.carga_rascunhos where titulo = 'Rascunho S01'), 0,
  'rebaixado a engenharia não lê mais o rascunho');
delete from public.carga_rascunhos where titulo = 'Rascunho S01';
reset role;
select is((select count(*)::int from public.carga_rascunhos where titulo = 'Rascunho S01'), 1,
  'nem apaga (o rascunho continua lá)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.carga_rascunhos where titulo = 'Rascunho S01'), 1, 'admin ativo continua vendo');
reset role;

-- retenção de 90 dias
set local session_replication_role = replica; -- sem o gatilho que carimba a data
update public.carga_rascunhos set atualizado_em = now() - interval '91 days' where titulo = 'Rascunho S01';
set local session_replication_role = origin;
select is(public.limpar_rascunhos_antigos() >= 1, true, 'rascunho parado há mais de 90 dias é apagado');
select is((select count(*)::int from cron.job where jobname = 'limpar-rascunhos-antigos'), 1, 'limpeza agendada');

-- S03: troca de e-mail no Auth chega ao cadastro
update auth.users set email = 'eng-novo@ito.local' where id = '00000000-0000-4000-8000-000000000003';
select is((select email from public.usuarios where id = '00000000-0000-4000-8000-000000000003'),
  'eng-novo@ito.local', 'e-mail do cadastro acompanha o do Auth');

-- S04: JSON da projeção com contrato no banco (chamada direta à API não grava qualquer coisa)
reset role;
insert into public.projecoes (id, nome, inicio, prazo_meses, area_m2)
  values ('33333333-3333-4333-8333-333333333333', 'Contrato', '2027-01-01', 3, 1000);
select lives_ok($$update public.projecoes set ajustes = '{"ped": 20, "serv": -100}',
  quantidades_manuais = '{"ped": [2, 3, 3]}', he_mix = '{"util": 70, "sabado": 30}',
  premissas = '{"riscoPct": 2, "provisionar": true, "funcoesTransferidas": ["ped"]}',
  regime = '{"ped": "sp"}', origem = '{"ped": "aloj"}',
  resumo = '{"total": 1234.5, "pico": 4, "pessoa_mes": 8, "vigente": 2026}'
  where id = '33333333-3333-4333-8333-333333333333'$$, 'projeção como a tela grava');
select lives_ok($$update public.projecoes set resumo = '{"total": 1, "indireta_pct": 12.5}',
  premissas = '{"foraDaSede": true}' where id = '33333333-3333-4333-8333-333333333333'$$,
  'chaves antigas das projeções salvas antes (indireta_pct, foraDaSede) seguem aceitas');
select throws_ok($$update public.projecoes set ajustes = '"20"' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'ajustes como texto recusado');
select throws_ok($$update public.projecoes set ajustes = '{"ped": 500}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'ajuste fora de −100% a +100% recusado');
select throws_ok($$update public.projecoes set quantidades_manuais = '{"ped": [1, "x"]}' where id = '33333333-3333-4333-8333-333333333333'$$,
  '23514', null, 'quantidade que não é número recusada');
select throws_ok($$update public.projecoes set he_mix = '{"domingo": 10}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'tipo de HE fora da lista recusado');
select throws_ok($$update public.projecoes set premissas = '{"lucroPct": 900}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'premissa fora de 0–100% recusada');
select throws_ok($$update public.projecoes set regime = '{"ped": "pj"}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'regime fora de CLT/S/P recusado');
select throws_ok($$update public.projecoes set origem = '{"ped": "lua"}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'origem fora da lista recusada');
select throws_ok($$update public.projecoes set resumo = '{"total": "muito"}' where id = '33333333-3333-4333-8333-333333333333'$$, '23514', null,
  'resumo fora do formato recusado');

-- S07: tetos de rascunhos e de lotes
insert into public.carga_rascunhos (usuario_id)
  select '00000000-0000-4000-8000-000000000004' from generate_series(1, 20);
select throws_ok($$insert into public.carga_rascunhos (usuario_id) values ('00000000-0000-4000-8000-000000000004')$$,
  '54000', null, 'no máximo 20 rascunhos por pessoa');
select throws_ok($$select public.gravar_carga('[]')$$, '22023', null, 'carga que não é objeto recusada');
select throws_ok($$select public.gravar_resumos((select jsonb_agg(jsonb_build_object('obra_id', i)) from generate_series(1, 5001) i))$$,
  '54000', null, 'no máximo 5.000 resumos por vez');

-- M14 · S07: cota de convites (20 por hora por administrador), só pela chave de serviço
reset role;
select is((select count(*)::int from generate_series(1, 21) i
           where public.usar_cota('00000000-0000-4000-8000-000000000001', 'convite', 20, '1 hour')),
  20, 'o 21º convite na mesma hora é recusado');
set local role authenticated;
select throws_ok($$select public.usar_cota('00000000-0000-4000-8000-000000000001', 'convite', 99, '1 hour')$$,
  '42501', null, 'a API não mexe na cota');

select * from finish();
rollback;
