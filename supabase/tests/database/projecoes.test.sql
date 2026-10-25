begin;
select plan(20);

select has_table('public', 'projecoes', 'tabela projecoes');
select is((select relrowsecurity from pg_class where oid = 'public.projecoes'::regclass), true, 'RLS ligada');

set local role authenticated;
-- planejamento cria e edita
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.projecoes (id, nome, inicio, prazo_meses, area_m2, cidade_id)
  values ('11111111-1111-4111-8111-111111111111', 'Projeção teste', '2027-03-01', 9, 4800, 'vespasiano');
select is((select nome from public.projecoes where id = '11111111-1111-4111-8111-111111111111'),
  'Projeção teste', 'planejamento cria');
update public.projecoes set area_m2 = 5000 where id = '11111111-1111-4111-8111-111111111111';
select is((select area_m2 from public.projecoes where id = '11111111-1111-4111-8111-111111111111'),
  5000.00, 'planejamento edita');
select throws_ok($$update public.projecoes set situacao = 'aprovada'
  where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'situação não muda por UPDATE direto');
select lives_ok($$select public.definir_situacao('11111111-1111-4111-8111-111111111111', 'em_analise')$$,
  'planejamento põe em análise');
select throws_ok($$select public.definir_situacao('11111111-1111-4111-8111-111111111111', 'aprovada')$$,
  '42501', null, 'planejamento não aprova');
select throws_ok($$update public.projecoes set reajuste_mes = 3 where id = '11111111-1111-4111-8111-111111111111'$$,
  '23514', null, 'reajuste informado precisa de mês e percentual');

-- DP/RH só lê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$insert into public.projecoes (nome, inicio, prazo_meses, area_m2)
  values ('x', '2027-01-01', 3, 100)$$, '42501', null, 'DP/RH não cria');
update public.projecoes set nome = 'outra' where id = '11111111-1111-4111-8111-111111111111';
select is((select nome from public.projecoes where id = '11111111-1111-4111-8111-111111111111'),
  'Projeção teste', 'DP/RH não edita');

-- diretoria aprova (mas não edita)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select lives_ok($$select public.definir_situacao('11111111-1111-4111-8111-111111111111', 'aprovada')$$,
  'diretoria aprova');
select is((select situacao::text from public.projecoes where id = '11111111-1111-4111-8111-111111111111'),
  'aprovada', 'aprovada');

-- aprovada fica travada para quem edita
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$update public.projecoes set area_m2 = 1 where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'aprovada não é alterada');
select throws_ok($$update public.projecoes set resumo = '{"total": 1}' where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'planejamento não regrava o resumo da aprovada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- M13 · S05: congelada também para quem aprova; a aprovação ficou na auditoria com os números
select throws_ok($$update public.projecoes set resumo = '{"total": 999999999}' where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'nem quem aprova (admin) muda o resumo da aprovada');
select is((select (depois -> 'resumo') is not null from public.auditoria
           where tabela = 'projecoes' and ref = '11111111-1111-4111-8111-111111111111'
             and depois ->> 'situacao' = 'aprovada' and antes ->> 'situacao' <> 'aprovada'),
  true, 'a aprovação fica na auditoria com o resumo aprovado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.definir_situacao('11111111-1111-4111-8111-111111111111', 'em_analise')$$,
  '42501', null, 'planejamento não desfaz a aprovação');
select throws_ok($$delete from public.projecoes where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'aprovada não é apagada');
-- autoria vem do banco
insert into public.projecoes (id, nome, inicio, prazo_meses, area_m2, criado_por)
  values ('22222222-2222-4222-8222-222222222222', 'Autoria', '2027-01-01', 3, 100, '00000000-0000-4000-8000-000000000001');
select is((select criado_por::text from public.projecoes where id = '22222222-2222-4222-8222-222222222222'),
  '00000000-0000-4000-8000-000000000002', 'autor é quem criou, não o informado');

-- M13 · S05: aprovar e trocar os números no mesmo passo não vale (admin aprova e edita)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$update public.projecoes set situacao = 'aprovada', resumo = '{"total": 5}'
  where id = '22222222-2222-4222-8222-222222222222'$$, '42501', null, 'aprovar sem mudar a projeção');

select * from finish();
rollback;
