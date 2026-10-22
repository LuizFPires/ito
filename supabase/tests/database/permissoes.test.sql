begin;
select plan(12);

-- um usuário de teste por perfil, mais um admin (o gatilho cria a linha em usuarios)
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'perm-' || coalesce(p, 'admin') || '@ito.local',
       jsonb_build_object('perfil', coalesce(p, 'engenharia'), 'admin', p is null), '{}'
from unnest(array['planejamento', 'engenharia', 'dp_rh', 'controladoria', 'diretoria', null]) p;

-- uma obra com lançamento e uma projeção para as operações reais (como admin do seed)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.gravar_carga($j${"obra": {"id": "perm_obra", "nome": "Obra Permissões", "area_m2": 1000,
  "inicio": "2025-03-01", "meses": 1, "data_base": 2025}, "competencias": [{"mes_idx": 0}],
  "lancamentos": [{"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1,
  "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1650}]}]}$j$::jsonb);
insert into public.projecoes (id, nome, inicio, prazo_meses, area_m2)
  values ('00000000-0000-4000-8000-0000000000bb', 'Projeção Permissões', '2027-01-01', 3, 1000);

-- faz a operação de verdade, com a RLS e as funções do banco, e desfaz em seguida
create function public.teste_consegue(op text) returns boolean language plpgsql as $$
declare
  n integer := 1;
begin
  begin
    case op
      when 'premissas' then
        update public.obras set risco_pct = risco_pct where id = 'perm_obra';
        get diagnostics n = row_count;
      when 'folha' then
        select count(*) into n from public.lancamentos where obra_id = 'perm_obra';
      when 'carga' then
        perform public.gravar_carga($j${"obra": {"id": "perm_obra2", "nome": "Obra Permissões 2",
          "area_m2": 1000, "inicio": "2025-03-01", "meses": 1, "data_base": 2025},
          "competencias": [{"mes_idx": 0}], "lancamentos": []}$j$::jsonb);
      when 'cidades' then
        update public.cidades set iss_pct = iss_pct where id = (select min(id) from public.cidades);
        get diagnostics n = row_count;
      when 'parametros' then
        update public.parametros set carnaval = carnaval;
        get diagnostics n = row_count;
      when 'funcoes' then
        update public.funcoes set nome = nome where id = 'ped';
        get diagnostics n = row_count;
      when 'rubricas' then
        update public.rubricas set nome = nome where codigo = 1;
        get diagnostics n = row_count;
      when 'projetar' then
        insert into public.projecoes (nome, inicio, prazo_meses, area_m2)
          values ('Teste', '2027-01-01', 3, 1000);
      when 'aprovar' then
        perform public.definir_situacao('00000000-0000-4000-8000-0000000000bb', 'aprovada');
      when 'auditoria' then
        select count(*) into n from public.auditoria;
      when 'usuarios' then
        perform public.listar_usuarios();
    end case;
    if n = 0 then return false; end if;
    raise exception using errcode = 'P0099'; -- deu certo: desfaz
  exception
    when sqlstate 'P0099' then return true;
    when others then return false;
  end;
end;
$$;
grant execute on function public.teste_consegue(text) to authenticated;

-- diverge: o que a tabela de permissões diz × o que as funções e a RLS deixam, por usuário
-- recebe os usuários prontos: lidos como postgres (a RLS de usuarios esconderia as linhas)
create function public.teste_divergencias(usuarios jsonb) returns setof text language plpgsql as $$
declare
  u record;
  t record;
  vistos integer := 0;
  op text;
  esperado boolean;
begin
  for u in select * from jsonb_to_recordset(usuarios)
             as x (id uuid, email text, perfil public.perfil, admin boolean) loop
    vistos := vistos + 1;
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    for t in select * from public.permissoes() x
             where x.admin = u.admin and (u.admin or x.perfil = u.perfil::text) loop
      -- funções pode_* (as telas e as políticas usam)
      if (t.ordem = 2 and t.le <> public.pode_carregar())
         or (t.ordem in (1, 3) and t.edita <> public.pode_carregar())
         or (t.ordem in (4, 5) and t.edita <> public.pode_editar_config())
         or (t.ordem in (6, 7) and t.edita <> public.pode_editar_cadastros())
         or (t.ordem = 8 and t.edita <> public.pode_projetar())
         or (t.ordem = 9 and t.aprova <> public.pode_aprovar())
         or (t.ordem = 11 and t.le <> public.pode_auditar())
         or (t.ordem = 12 and t.le <> public.sou_admin()) then
        return next u.email || ': função de ' || t.modulo;
      end if;
      -- a operação real de cada módulo (exportações não têm operação própria no banco)
      op := (array['premissas', 'folha', 'carga', 'cidades', 'parametros', 'funcoes', 'rubricas',
                   'projetar', 'aprovar', null, 'auditoria', 'usuarios'])[t.ordem];
      esperado := case t.ordem when 2 then t.le when 9 then t.aprova when 11 then t.le
                               when 12 then t.le else t.edita end;
      if op is not null and public.teste_consegue(op) <> esperado then
        return next u.email || ': ' || t.modulo || case when esperado
          then ' (a tabela diz que pode, o banco nega)' else ' (o banco deixa, a tabela diz que não)' end;
      end if;
    end loop;
  end loop;
  if vistos <> 6 then return next 'usuários de teste conferidos: ' || vistos; end if;
end;
$$;
grant execute on function public.teste_divergencias(jsonb) to authenticated;

select is((select count(*)::integer from public.permissoes()), 12 * 6, '12 módulos × 6 colunas');

select set_config('teste.usuarios', (select jsonb_agg(jsonb_build_object('id', id, 'email', email,
  'perfil', perfil, 'admin', admin)) from public.usuarios where email like 'perm-%')::text, true);
set local role authenticated;
select is(array(select public.teste_divergencias(current_setting('teste.usuarios')::jsonb)), array[]::text[],
  'tabela de permissões = funções pode_* e operação real de cada módulo, por perfil e admin');

-- quem não carrega vê a folha por matrícula só nos totais
select is((select so_totais from public.permissoes() where ordem = 2 and perfil = 'engenharia'),
  true, 'engenharia vê só os totais da folha');

-- desativado perde a escrita na hora
reset role;
update public.usuarios set ativo = false where email = 'perm-dp_rh@ito.local';
-- o id é lido antes de virar "authenticated" (a RLS esconderia a linha de outro usuário)
select set_config('request.jwt.claims', jsonb_build_object('sub',
  (select id from public.usuarios where email = 'perm-dp_rh@ito.local'), 'role', 'authenticated')::text, true);
select isnt(current_setting('request.jwt.claims')::jsonb ->> 'sub', null, 'claims do desativado');
set local role authenticated;
select is(public.pode_carregar(), false, 'desativado não carrega');
select is((select count(*)::integer from public.funcoes), 0, 'desativado não lê nem os cadastros');
select is((select count(*)::integer from public.usuarios), 1, 'desativado ainda vê a própria linha (aviso na tela)');

-- lista de usuários: só o admin
select throws_ok('select * from public.listar_usuarios()', '42501', null, 'não admin não lista');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select ok((select count(*) from public.listar_usuarios()) >= 11, 'admin lista todos');

-- desativar não passa pela API; e o ITO nunca fica sem admin ativo
select throws_ok($$update public.usuarios set ativo = false
                   where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'situação só muda pela função de usuários (Edge Function), nem para o admin');
reset role;
update public.usuarios set admin = false where email = 'perm-admin@ito.local';
select throws_ok($$update public.usuarios set admin = false
                   where id = '00000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'sempre fica um admin ativo');
select is((select count(*)::integer from public.usuarios where admin and ativo), 1,
  'o último admin continua');

select * from finish();
rollback;
