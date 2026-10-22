// Restauração de um backup do ITO (M10) no Supabase LOCAL, para ensaio ou para conferir dados:
// recria o banco pelas migrações (pnpm db:reset), apaga o que o seed e as cargas iniciais
// puseram e carrega o dados.sql do backup com os gatilhos desligados (a auditoria não registra a
// restauração). Restaurar em homologação ou produção segue docs/OPERACAO.md (não por aqui).
//
//   pnpm db:restaurar <pasta do backup>
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const pasta = process.argv[2] && resolve(process.argv[2]);
if (!pasta || !existsSync(join(pasta, "dados.sql"))) {
  console.log("Uso: pnpm db:restaurar <pasta do backup com dados.sql>");
  process.exit(1);
}
const projeto = /project_id\s*=\s*"([^"]+)"/.exec(
  readFileSync(join(REPO, "supabase/config.toml"), "utf8"),
)?.[1];
const container = `supabase_db_${projeto}`;

console.log("recriando o banco local pelas migrações…");
execSync("pnpm db:reset", { cwd: REPO, stdio: ["ignore", "ignore", "inherit"] });

// esvazia public e auth (dados das migrações e do seed) antes de carregar o backup
const limpar = `
do $$
declare t text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t
  from pg_tables where schemaname in ('public', 'auth')
    and tablename not in ('schema_migrations');
  execute 'truncate table ' || t || ' cascade';
end $$;`;
const psql = (entrada) =>
  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    {
      input: entrada,
      stdio: ["pipe", "pipe", "inherit"],
      maxBuffer: 1 << 30,
    },
  ).toString();

psql(limpar);
console.log("carregando os dados do backup…");
psql(
  "begin;\nset session_replication_role = replica;\n" +
    readFileSync(join(pasta, "dados.sql"), "utf8") +
    "\nset session_replication_role = origin;\ncommit;\n",
);
const contagem = psql(
  "\\pset tuples_only on\nselect 'obras ' || count(*) from public.obras union all " +
    "select 'lançamentos ' || count(*) from public.lancamentos union all " +
    "select 'usuários ' || count(*) from public.usuarios union all " +
    "select 'projeções ' || count(*) from public.projecoes;",
);
console.log(
  contagem
    .trim()
    .split(/\s*\n\s*/)
    .join(" · "),
);
console.log("restaurado no Supabase local.");
