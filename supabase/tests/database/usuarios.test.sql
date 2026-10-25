begin;
select plan(14);

-- Estrutura
select has_table('public', 'usuarios', 'tabela usuarios existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.usuarios'::regclass), true, 'RLS ligada');
select hasnt_column('public', 'usuarios', 'cpf', 'sem CPF');

-- O seed criou a linha via gatilho, com perfil do app_metadata
select is(
  (select perfil::text from public.usuarios where email = 'dprh@ito.local'), 'dp_rh',
  'gatilho copia o perfil do app_metadata');
select is(
  (select admin from public.usuarios where email = 'admin@ito.local'), true, 'admin do seed');

-- Anônimo não lê nada
set local role anon;
select throws_ok('select * from public.usuarios', '42501', null, 'anônimo sem acesso');
reset role;

-- Usuário comum: vê só a si mesmo e não altera nada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.usuarios), 1, 'comum vê só a própria linha');
select is(public.meu_perfil()::text, 'engenharia', 'meu_perfil');
select is(public.sou_admin(), false, 'comum não é admin');
update public.usuarios set admin = true where id = '00000000-0000-4000-8000-000000000003';
select is(
  (select admin from public.usuarios where id = '00000000-0000-4000-8000-000000000003'), false,
  'comum não se promove a admin');
select throws_ok(
  $$update public.usuarios set email = 'x@x' where id = '00000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'e-mail não é editável pela API');

-- Admin: vê todos e altera perfil de outro
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.usuarios), 6, 'admin vê todos (5 perfis + conta do teste de MFA)');
update public.usuarios set perfil = 'planejamento' where id = '00000000-0000-4000-8000-000000000003';
select is(
  (select perfil::text from public.usuarios where id = '00000000-0000-4000-8000-000000000003'),
  'planejamento', 'admin altera perfil');
select throws_ok(
  $$update public.usuarios set admin = false where id = '00000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'admin não remove o próprio admin');

select * from finish();
rollback;
