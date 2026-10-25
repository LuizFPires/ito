begin;
select plan(7);

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

select * from finish();
rollback;
