// Backup do banco do ITO (M10): esquema e dados (public + auth) numa pasta FORA do repositório.
// Os backups diários do Supabase são a primeira linha; este é o complemento sob nosso controle.
//
//   pnpm db:backup local|homologacao|producao [--pasta <dir>]
//
// Homologação e produção pedem a senha do banco em .env.supabase.local
// (SUPABASE_DB_PASSWORD_HOMOLOGACAO / SUPABASE_DB_PASSWORD_PRODUCAO). O dump traz valores por
// matrícula (sem nomes): guarde a pasta em local com acesso restrito.
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

// o backup traz contas (hash de senha) e valores por matrícula: só o dono lê, desde a criação
process.umask(0o077);

const REPO = resolve(import.meta.dirname, "..");
const PROJETOS = { homologacao: "rtciuljdjdvocxitaepz", producao: "pntkdmzbuqvhypebbhhn" };

function env() {
  const f = join(REPO, ".env.supabase.local");
  if (!existsSync(f)) return {};
  return Object.fromEntries(
    readFileSync(f, "utf8")
      .split(/\r?\n/)
      .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim()))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^"|"$/g, "")]),
  );
}

const [ambiente, ...resto] = process.argv.slice(2);
if (!["local", "homologacao", "producao"].includes(ambiente)) {
  console.log("Uso: pnpm db:backup local|homologacao|producao [--pasta <dir>]");
  process.exit(1);
}
const i = resto.indexOf("--pasta");
const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const pasta = resolve(
  i >= 0 ? resto[i + 1] : join(homedir(), "ITO-backups", `${ambiente}-${carimbo}`),
);
if (!relative(REPO, pasta).startsWith("..")) {
  console.error("A pasta do backup fica fora do repositório (os dados não vão para o git).");
  process.exit(1);
}
mkdirSync(pasta, { recursive: true, mode: 0o700 });
chmodSync(pasta, 0o700);

// a senha vai para o CLI pela variável de ambiente, não pela linha de comando
let senha = "";
if (ambiente !== "local") {
  senha = env()[`SUPABASE_DB_PASSWORD_${ambiente.toUpperCase()}`] ?? "";
  if (!senha) {
    console.error(`Falta SUPABASE_DB_PASSWORD_${ambiente.toUpperCase()} em .env.supabase.local.`);
    process.exit(1);
  }
}
const alvo = ambiente === "local" ? "--local" : `--project-ref ${PROJETOS[ambiente]}`;

const dump = (arquivo, extra = "") => {
  execSync(
    `pnpm exec supabase db dump ${alvo} ${extra} -f ${JSON.stringify(join(pasta, arquivo))}`,
    {
      cwd: REPO,
      stdio: ["ignore", "ignore", "inherit"],
      env: senha ? { ...process.env, SUPABASE_DB_PASSWORD: senha } : process.env,
    },
  );
  chmodSync(join(pasta, arquivo), 0o600);
  return statSync(join(pasta, arquivo)).size;
};

const tamanhos = {
  "esquema.sql": dump("esquema.sql"),
  // dados de public (o ITO) e de auth (contas: sem elas a tabela usuarios não volta); sessões
  // e tokens de renovação ficam de fora (quem restaura entra de novo)
  "dados.sql": dump(
    "dados.sql",
    "--data-only --use-copy --schema public,auth -x auth.sessions,auth.refresh_tokens",
  ),
};
writeFileSync(
  join(pasta, "LEIA-ME.txt"),
  [
    `Backup do ITO — ${ambiente} — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    "esquema.sql: estrutura (as migrações em supabase/migrations também a recriam)",
    "dados.sql: dados de public e auth. Restaurar no local: pnpm db:restaurar <esta pasta>",
    "Contém valores por matrícula (sem nomes). Guarde com acesso restrito.",
    "",
  ].join("\n"),
);
for (const [k, v] of Object.entries(tamanhos)) console.log(`${k}: ${Math.round(v / 1024)} KB`);
console.log(`backup em ${pasta}`);
