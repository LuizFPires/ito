begin;
select plan(18);

-- controladoria (admin do seed) muda um parâmetro: fica a versão anterior e a nova
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.parametros set carnaval = not carnaval;
select is((select count(*)::integer from public.auditoria where tabela = 'parametros'), 1,
  'alteração do parâmetro auditada');
select isnt((select depois ->> 'carnaval' from public.auditoria where tabela = 'parametros'),
  (select antes ->> 'carnaval' from public.auditoria where tabela = 'parametros'),
  'guarda o antes e o depois');
select is((select usuario_email from public.auditoria where tabela = 'parametros'), 'admin@ito.local',
  'guarda quem alterou');

-- atualização sem mudança não conta
update public.parametros set carnaval = carnaval;
select is((select count(*)::integer from public.auditoria where tabela = 'parametros'), 1,
  'atualização sem mudança não é registrada');

-- ninguém grava nem apaga a auditoria pela API
select throws_ok($$insert into public.auditoria (modulo, tabela, registro, operacao)
                   values ('x', 'x', '{}', 'insert')$$, '42501', null, 'insert recusado');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'delete recusado');
select throws_ok($$update public.auditoria set modulo = 'x'$$, '42501', null, 'update recusado');

-- carga: registra a obra, não as linhas por mês e por matrícula
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.gravar_carga($j${
  "obra": {"id": "aud", "nome": "Obra Auditada", "area_m2": 1000, "inicio": "2025-03-01",
           "meses": 1, "data_base": 2025},
  "competencias": [{"mes_idx": 0}],
  "sinonimos": [{"texto": "PEDREIRO AUDITADO", "funcao_id": "ped"}],
  "rubricas_novas": [{"codigo": 987654, "nome": "PRÊMIO AUDITADO", "tipo": "provento",
                      "componente": "extras"}],
  "lancamentos": [{"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1,
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1650}]}]}$j$::jsonb);
-- DP/RH não lê a auditoria
select is((select count(*)::integer from public.auditoria), 0, 'DP/RH não lê a auditoria');

-- diretoria lê; a carga deixou só a obra; a edição da premissa depois da carga entra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select array_agg(tabela order by tabela) from public.auditoria where ref = 'aud'),
  array['obras'], 'a carga registra a obra, sem as linhas por mês');
select is((select count(*)::integer from public.auditoria
           where (tabela = 'funcao_sinonimos' and registro ->> 'texto' = 'PEDREIRO AUDITADO')
              or (tabela = 'rubricas' and registro ->> 'codigo' = '987654')), 2,
  'cadastros que a carga muda (sinônimo, rubrica nova) entram na auditoria');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
update public.competencias set licenca_pessoa_dias = 3 where obra_id = 'aud';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*)::integer from public.auditoria where ref = 'aud' and tabela = 'competencias'), 1,
  'edição de ausências depois da carga é auditada');
select is((select registro from public.auditoria where ref = 'aud' and tabela = 'competencias'),
  '{"obra_id": "aud", "mes_idx": 0}'::jsonb, 'chave do registro');

-- alteração de usuário: a diretoria não lê (segue a RLS de usuarios); o admin lê
reset role;
update public.usuarios set nome = 'Planejamento 2' where email = 'planejamento@ito.local';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*)::integer from public.auditoria where modulo = 'usuarios'), 0,
  'diretoria não lê a auditoria de usuários');

-- resumo recalculado da projeção não é alteração de quem abriu
reset role;
insert into public.projecoes (id, nome, inicio, prazo_meses, area_m2)
  values ('00000000-0000-4000-8000-0000000000aa', 'Auditada', '2027-01-01', 3, 1000);
update public.projecoes set resumo = '{"total": 1}'::jsonb where id = '00000000-0000-4000-8000-0000000000aa';
select is((select count(*)::integer from public.auditoria
           where tabela = 'projecoes' and operacao = 'update'
             and ref = '00000000-0000-4000-8000-0000000000aa'), 0,
  'regravar o resumo da projeção não entra na auditoria');

-- ações da gestão de usuários (chave de serviço) ficam com o admin que chamou
-- como chega a chave de serviço: sem "sub" no token
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is(public.gerir_usuario('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003', '{"perfil": "planejamento"}'), 1, 'gerir_usuario grava');
reset role;
select is((select usuario_email from public.auditoria where tabela = 'usuarios'
           and registro ->> 'id' = '00000000-0000-4000-8000-000000000003'
           and depois ->> 'perfil' = 'planejamento'), 'admin@ito.local',
  'autor da ação feita pela função de usuários');

-- nem a chave de serviço altera ou apaga a auditoria
set local role service_role;
select throws_ok($$delete from public.auditoria$$, '42501', null, 'service_role não apaga');
reset role;
select throws_ok($$update public.auditoria set modulo = 'x'$$, '42501', null,
  'nem o dono do banco altera (gatilho)');

select * from finish();
rollback;
