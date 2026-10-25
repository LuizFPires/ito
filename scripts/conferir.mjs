// Conferência remota (M14): o catálogo de homologação ou de produção é o que as migrações dão?
// Compara uma "impressão" do schema public (tabelas e RLS, colunas, políticas, funções com corpo,
// security definer e permissões, grants, gatilhos, restrições e migrações aplicadas) do projeto
// remoto com a do Supabase local (pnpm db:reset antes: banco recriado só pelas migrações).
// Só lê. Não mostra dados, só nomes de objetos.
//
//   pnpm db:conferir homologacao|producao
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const PROJETOS = { homologacao: "rtciuljdjdvocxitaepz", producao: "pntkdmzbuqvhypebbhhn" };
const ambiente = process.argv[2];
if (!PROJETOS[ambiente]) {
  console.log("Uso: pnpm db:conferir homologacao|producao");
  process.exit(1);
}

const PAPEIS = "('anon', 'authenticated', 'service_role')";
const IMPRESSAO = `
select linha from (
  select 'tabela ' || c.relname || ' rls=' || c.relrowsecurity as linha
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  union all
  select 'coluna ' || table_name || '.' || column_name || ' ' || data_type || ' nulo=' || is_nullable
         || ' padrao=' || md5(coalesce(column_default, ''))
    from information_schema.columns where table_schema = 'public'
  union all
  select 'politica ' || tablename || '.' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',')
         || ' ' || md5(coalesce(qual, '') || '|' || coalesce(with_check, ''))
    from pg_policies where schemaname = 'public'
  union all
  select 'funcao ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
         || md5(p.prosrc) || ' definer=' || p.prosecdef
         || ' exec=' || coalesce((select string_agg(r, ',' order by r) from unnest(array['anon', 'authenticated', 'service_role']) r
                                  where has_function_privilege(r, p.oid, 'execute')), '-')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  union all
  select 'grant ' || table_name || ' ' || grantee || ' ' || string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ${PAPEIS}
    group by table_name, grantee
  union all
  select 'gatilho ' || c.relname || '.' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  union all
  select 'restricao ' || c.relname || '.' || k.conname || ' ' || md5(pg_get_constraintdef(k.oid))
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  union all
  select 'migracao ' || version from supabase_migrations.schema_migrations
) x order by 1`;

function local() {
  const projeto = /project_id\s*=\s*"([^"]+)"/.exec(
    readFileSync(join(REPO, "supabase/config.toml"), "utf8"),
  )?.[1];
  const saida = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${projeto}`,
      "psql",
      "-U",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: IMPRESSAO.replace(/\n/g, " ") + ";", encoding: "utf8", maxBuffer: 1 << 28 },
  );
  return saida.split(/\r?\n/).filter(Boolean);
}

function remoto(ref) {
  const cli = join(REPO, "node_modules", "supabase", "dist", "supabase.js");
  const saida = execFileSync(
    process.execPath,
    [cli, "db", "query", "--linked", "--project-ref", ref, IMPRESSAO.replace(/\n/g, " ")],
    { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] },
  );
  const json = JSON.parse(saida.slice(saida.indexOf("{")));
  return json.rows.map((r) => r.linha);
}

const a = new Set(local());
const b = new Set(remoto(PROJETOS[ambiente]));
const soLocal = [...a].filter((x) => !b.has(x));
const soRemoto = [...b].filter((x) => !a.has(x));
console.log(`${ambiente}: ${b.size} itens no remoto, ${a.size} nas migrações (local)`);
if (!soLocal.length && !soRemoto.length) {
  console.log("Sem divergência: o banco remoto é o que as migrações dão.");
  process.exit(0);
}
for (const x of soLocal) console.log(`  falta no remoto:   ${x}`);
for (const x of soRemoto) console.log(`  só no remoto:      ${x}`);
console.log(
  "Divergências acima: migração não aplicada (db push) ou mudança feita fora das migrações (refazer como migração).",
);
process.exit(2);
