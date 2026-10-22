begin;
select plan(12);

-- um usuário de teste por perfil, mais um admin (o gatilho cria a linha em usuarios)
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'perm-' || coalesce(p, 'admin') || '@ito.local',
       jsonb_build_object('perfil', coalesce(p, 'engenharia'), 'admin', p is null), '{}'
from unnest(array['planejamento', 'engenharia', 'dp_rh', 'controladoria', 'diretoria', null]) p;

-- diverge: o que a tabela de permissões diz × o que as funções e a RLS deixam, por usuário
-- recebe os usuários prontos: lidos como postgres (a RLS de usuarios esconderia as linhas)
create function public.teste_divergencias(usuarios jsonb) returns setof text language plpgsql as $$
declare
  u record;
  t record;
  linhas integer;
  vistos integer := 0;
begin
  for u in select * from jsonb_to_recordset(usuarios)
             as x (id uuid, email text, perfil public.perfil, admin boolean) loop
    vistos := vistos + 1;
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    for t in select * from public.permissoes() x
             where x.admin = u.admin and (u.admin or x.perfil = u.perfil::text) loop
      if (t.ordem = 2 and t.le <> public.pode_carregar())
         or (t.ordem = 3 and t.edita <> public.pode_carregar())
         or (t.ordem in (4, 5) and t.edita <> public.pode_editar_config())
         or (t.ordem in (6, 7) and t.edita <> public.pode_editar_cadastros())
         or (t.ordem = 8 and t.edita <> public.pode_projetar())
         or (t.ordem = 9 and t.aprova <> public.pode_aprovar())
         or (t.ordem = 11 and t.le <> public.pode_auditar())
         or (t.ordem = 12 and t.le <> public.sou_admin()) then
        return next u.email || ': ' || t.modulo;
      end if;
      -- a RLS de verdade: parâmetros e funções
      if t.ordem = 5 then
        update public.parametros set carnaval = carnaval;
        get diagnostics linhas = row_count;
        if (linhas > 0) <> t.edita then return next u.email || ': RLS de parâmetros'; end if;
      elsif t.ordem = 6 then
        update public.funcoes set nome = nome where id = 'ped';
        get diagnostics linhas = row_count;
        if (linhas > 0) <> t.edita then return next u.email || ': RLS de funções'; end if;
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
  'tabela de permissões = funções pode_* e RLS, para cada perfil e para o admin');

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
