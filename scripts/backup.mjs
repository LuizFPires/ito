// Backup do banco do ITO (M10): esquema e dados (public + auth) numa pasta FORA do repositório.
// Os backups diários do Supabase são a primeira linha; este é o complemento sob nosso controle.
//
//   pnpm db:backup local|homologacao|producao [--pasta <dir>] [--cifrar]
//
// --cifrar (M13 · S08): grava esquema e dados cifrados (AES-256-GCM, scripts/cifra.mjs) com a
// frase de ITO_BACKUP_CHAVE, que fica no cofre e nunca na pasta do backup.
//
// Homologação e produção pedem a senha do banco em .env.supabase.local
// (SUPABASE_DB_PASSWORD_HOMOLOGACAO / SUPABASE_DB_PASSWORD_PRODUCAO). O dump traz valores por
// matrícula (sem nomes): no Windows, a pasta perde a herança de permissões e fica só com o
// próprio usuário (icacls); em outros sistemas, umask e chmod 700.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { cifrarArquivo, exigirFrase, EXTENSAO } from "./cifra.mjs";

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
  console.log("Uso: pnpm db:backup local|homologacao|producao [--pasta <dir>] [--cifrar]");
  process.exit(1);
}
const i = resto.indexOf("--pasta");
if (i >= 0 && !resto[i + 1]) {
  console.error("Informe a pasta depois de --pasta.");
  process.exit(1);
}
const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const pasta = resolve(
  i >= 0 ? resto[i + 1] : join(homedir(), "ITO-backups", `${ambiente}-${carimbo}`),
);
// fora do repositório: outro disco (caminho absoluto) ou acima dele ("..\x", não "..x")
const rel = relative(REPO, pasta);
if (!(isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`))) {
  console.error("A pasta do backup fica fora do repositório (os dados não vão para o git).");
  process.exit(1);
}

const cifrar = resto.includes("--cifrar");
let frase = "";
if (cifrar) {
  try {
    frase = exigirFrase(process.env.ITO_BACKUP_CHAVE ?? env().ITO_BACKUP_CHAVE);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

mkdirSync(pasta, { recursive: true, mode: 0o700 });
chmodSync(pasta, 0o700);
// no Windows, umask e chmod não valem: a pasta perde a herança e fica só com o próprio usuário
if (process.platform === "win32") {
  const eu = userInfo().username;
  execFileSync("icacls", [pasta, "/inheritance:r", "/grant:r", `${eu}:(OI)(CI)F`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  // cada permissão é "QUEM:(...)"; só a do próprio usuário pode sobrar
  const outros = execFileSync("icacls", [pasta], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((l) => l.includes(":(") && !l.toLowerCase().includes(`\\${eu.toLowerCase()}:`));
  if (outros.length) {
    console.error("A pasta do backup ficou acessível a outros usuários. Confira com icacls.");
    process.exit(1);
  }
}

// a senha vai para o CLI pela variável de ambiente, não pela linha de comando
let senha = "";
if (ambiente !== "local") {
  senha = env()[`SUPABASE_DB_PASSWORD_${ambiente.toUpperCase()}`] ?? "";
  if (!senha) {
    console.error(`Falta SUPABASE_DB_PASSWORD_${ambiente.toUpperCase()} em .env.supabase.local.`);
    process.exit(1);
  }
}
const alvo = ambiente === "local" ? ["--local"] : ["--project-ref", PROJETOS[ambiente]];
// o CLI do Supabase direto pelo node, com argumentos em lista (sem montar linha de shell)
const CLI = join(REPO, "node_modules", "supabase", "dist", "supabase.js");

// segredos do Auth que não voltam num restauro: sessões, tokens, fatores de MFA (com o segredo
// do autenticador), desafios e logs. Quem restaura entra de novo e reinscreve o MFA.
const FORA_DO_BACKUP = [
  "auth.sessions",
  "auth.refresh_tokens",
  "auth.one_time_tokens",
  "auth.flow_state",
  "auth.mfa_factors",
  "auth.mfa_challenges",
  "auth.mfa_amr_claims",
  "auth.mfa_recovery_codes",
  "auth.mfa_recovery_code_sets",
  "auth.webauthn_credentials",
  "auth.webauthn_challenges",
  "auth.audit_log_entries",
  "auth.saml_relay_states",
  "auth.oauth_authorizations",
  "auth.oauth_client_states",
  "auth.oauth_consents",
  "auth.scim_tokens",
];

const dump = async (arquivo, extra = []) => {
  const destino = join(pasta, arquivo);
  execFileSync(process.execPath, [CLI, "db", "dump", ...alvo, ...extra, "-f", destino], {
    cwd: REPO,
    stdio: ["ignore", "ignore", "inherit"],
    env: senha ? { ...process.env, SUPABASE_DB_PASSWORD: senha } : process.env,
  });
  chmodSync(destino, 0o600);
  if (!cifrar) return [arquivo, statSync(destino).size];
  await cifrarArquivo(destino, destino + EXTENSAO, frase);
  rmSync(destino);
  return [arquivo + EXTENSAO, statSync(destino + EXTENSAO).size];
};

const tamanhos = Object.fromEntries([
  await dump("esquema.sql"),
  // dados de public (o ITO) e de auth (contas: sem elas a tabela usuarios não volta)
  await dump("dados.sql", [
    "--data-only",
    "--use-copy",
    "--schema",
    "public,auth",
    "-x",
    FORA_DO_BACKUP.join(","),
  ]),
]);
writeFileSync(
  join(pasta, "LEIA-ME.txt"),
  [
    `Backup do ITO — ${ambiente} — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    "esquema.sql: estrutura (as migrações em supabase/migrations também a recriam)",
    "dados.sql: dados de public e auth. Restaurar no local: pnpm db:restaurar <esta pasta>",
    cifrar
      ? "Arquivos cifrados (.cifrado): abrem só com a frase de ITO_BACKUP_CHAVE, guardada no cofre."
      : "Sem cifragem: contém valores por matrícula (sem nomes). Guarde com acesso restrito.",
    "Sessões, tokens e fatores de MFA não entram: depois de restaurar, cada pessoa entra de novo.",
    "",
  ].join("\n"),
);
for (const [k, v] of Object.entries(tamanhos)) console.log(`${k}: ${Math.round(v / 1024)} KB`);
console.log(`backup em ${pasta}`);
