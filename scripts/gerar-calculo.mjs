// Empacota o cálculo da aprovação (apps/web/src/servidor/aprovacao.ts: carregadores + motor) para
// a Edge Function `projecoes` (M14 · S05). O arquivo gerado é versionado e o CI confere que está
// em dia: a função roda exatamente o código da tela.
//
//   pnpm gen:calculo
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const REPO = resolve(import.meta.dirname, "..");
const SAIDA = join(REPO, "supabase", "functions", "projecoes", "calculo.gerado.js");

const r = await build({
  entryPoints: [join(REPO, "apps", "web", "src", "servidor", "aprovacao.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  write: false,
  legalComments: "none",
  logLevel: "warning",
});
let codigo = r.outputFiles[0].text;
// a versão é o hash do próprio código (com o marcador), igual em qualquer máquina
const versao = createHash("sha256").update(codigo).digest("hex").slice(0, 16);
codigo = codigo.replace('"__VERSAO_CALCULO__"', JSON.stringify(versao));
writeFileSync(
  SAIDA,
  `// GERADO por scripts/gerar-calculo.mjs a partir de apps/web/src/servidor/aprovacao.ts.\n// Não edite: rode pnpm gen:calculo.\n${codigo}`,
);
console.log(`calculo.gerado.js · versão ${versao} · ${Math.round(codigo.length / 1024)} kB`);
