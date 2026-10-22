begin;
select plan(12);

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
  "lancamentos": [{"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1,
     "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1650}]}]}$j$::jsonb);
-- DP/RH não lê a auditoria
select is((select count(*)::integer from public.auditoria), 0, 'DP/RH não lê a auditoria');

-- diretoria lê; a carga deixou só a obra; a edição da premissa depois da carga entra
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select array_agg(tabela order by tabela) from public.auditoria where ref = 'aud'),
  array['obras'], 'a carga registra só a obra');
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

select * from finish();
rollback;
