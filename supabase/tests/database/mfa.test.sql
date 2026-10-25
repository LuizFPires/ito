begin;
select plan(13);

-- M13 · S02: administrador, controladoria e diretoria só acessam com o segundo fator (AAL2)
-- mfa@ito.local = diretoria sem dispensa (as demais contas do seed estão dispensadas)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}', true);
select is(public.preciso_de_mfa(), true, 'diretoria precisa de MFA');
select is(public.sou_ativo(), false, 'em AAL1 não conta como ativo');
select is((select count(*)::int from public.funcoes), 0, 'em AAL1 não lê cadastros pela API');
select is(public.pode_aprovar(), false, 'em AAL1 não aprova');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2"}', true);
select is(public.sou_ativo(), true, 'em AAL2 é ativo');
select ok((select count(*) from public.funcoes) > 0, 'em AAL2 lê os cadastros');
select is(public.pode_aprovar(), true, 'em AAL2 aprova');

-- perfil que não exige MFA segue só com senha
reset role;
update public.usuarios set mfa_dispensado = false
  where id in ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is(public.preciso_de_mfa(), false, 'planejamento não precisa de MFA');
select is(public.pode_projetar(), true, 'planejamento projeta só com senha');

-- administrador em AAL1 não administra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(public.sou_admin(), false, 'admin em AAL1 não é admin');
select throws_ok($$select * from public.listar_usuarios()$$, '42501', null, 'admin em AAL1 não lista usuários');
update public.usuarios set admin = true where id = '00000000-0000-4000-8000-000000000003';
reset role;
select is((select admin from public.usuarios where id = '00000000-0000-4000-8000-000000000003'), false,
  'admin em AAL1 não promove ninguém');

-- S06: o autor das ações de usuários precisa ser admin ativo na hora de gravar
select throws_ok($$select public.gerir_usuario('00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002', '{"perfil":"diretoria"}')$$, '42501', null,
  'autor sem admin não gere usuários (mesmo pela chave de serviço)');

select * from finish();
rollback;
