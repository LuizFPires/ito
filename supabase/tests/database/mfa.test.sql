begin;
select plan(16);

-- M13 · S02: administrador, controladoria e diretoria só acessam com o segundo fator (AAL2)
-- mfa@ito.local = diretoria sem dispensa (as demais contas do seed estão dispensadas)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}', true);
select is(public.preciso_de_mfa(), true, 'diretoria precisa de MFA');
select is(public.sou_ativo(), false, 'em AAL1 não conta como ativo');
select is((select count(*)::int from public.funcoes), 0, 'em AAL1 não lê cadastros pela API');
select is(public.pode_aprovar(), false, 'em AAL1 não aprova');

-- AAL2 só vale com a sessão do token viva (revisão do M13)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-a000-000000000066"}', true);
select is(public.sou_ativo(), false, 'AAL2 sem sessão no Auth não vale');
reset role;
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
  values ('00000000-0000-4000-a000-000000000066', '00000000-0000-4000-8000-000000000006', 'aal1', now(), now());
set local role authenticated;
select is(public.sou_ativo(), false, 'sessão ainda em AAL1 não vale');
reset role;
update auth.sessions set aal = 'aal2' where id = '00000000-0000-4000-a000-000000000066';
set local role authenticated;
select is(public.sou_ativo(), true, 'em AAL2 é ativo');
select ok((select count(*) from public.funcoes) > 0, 'em AAL2 lê os cadastros');
select is(public.pode_aprovar(), true, 'em AAL2 aprova');

-- zerar o MFA encerra as sessões: o token que já estava na mão para de valer na hora
reset role;
select public.encerrar_sessoes('00000000-0000-4000-8000-000000000006');
set local role authenticated;
select is(public.sou_ativo(), false, 'sessão encerrada derruba o token AAL2');

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
