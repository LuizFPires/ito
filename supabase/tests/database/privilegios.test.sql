begin;
select plan(8);

-- M13: objeto novo no public nasce fechado; os que existem seguem com RLS e sem acesso anônimo
select is((select count(*)::integer
           from pg_default_acl d
           join pg_namespace n on n.oid = d.defaclnamespace
           cross join lateral aclexplode(d.defaclacl) a
           where n.nspname = 'public' and d.defaclrole = 'postgres'::regrole
             and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 0)),
  0, 'privilégios padrão do public não dão nada a anon, authenticated nem public');

create table public.teste_nova (id integer primary key);
create function public.teste_nova_fn() returns integer language sql as $$ select 1 $$;
select is(has_table_privilege('authenticated', 'public.teste_nova', 'select'), false,
  'tabela nova não é lida por authenticated sem grant');
select is(has_table_privilege('anon', 'public.teste_nova', 'select'), false,
  'tabela nova não é lida por anon');
select is(has_function_privilege('authenticated', 'public.teste_nova_fn()', 'execute'), false,
  'função nova não é executada por authenticated sem grant');
drop function public.teste_nova_fn();
drop table public.teste_nova;

select is(array(select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
                order by 1),
  array[]::text[], 'toda tabela do public com RLS ligada');
select is(array(select table_name::text from information_schema.role_table_grants
                where grantee = 'anon' and table_schema = 'public' group by 1 order by 1),
  array[]::text[], 'anon não tem acesso a tabela nenhuma do public');
select is(array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
                order by 1),
  array[]::text[], 'anon não executa função nenhuma do public');

-- funções chamadas pelos CHECKs: quem grava pela API precisa executá-las
select is(array(select distinct p.proname::text
                from pg_constraint c
                join pg_namespace n on n.oid = c.connamespace and n.nspname = 'public'
                join pg_depend d on d.objid = c.oid and d.classid = 'pg_constraint'::regclass
                                and d.refclassid = 'pg_proc'::regclass
                join pg_proc p on p.oid = d.refobjid
                where not has_function_privilege('authenticated', p.oid, 'execute')
                order by 1),
  array[]::text[], 'funções dos CHECKs executáveis por authenticated');

select * from finish();
rollback;
