// M12: tamanho do código baixado (build de produção), comprimido com gzip como o navegador recebe.
// Uso: pnpm perf:bundle (depois do build). Grava docs/performance/bundle.json.
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "apps/web/dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const iniciais = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]));
const arquivos = readdirSync(join(dist, "assets"))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => {
    const buf = readFileSync(join(dist, "assets", f));
    return {
      arquivo: f,
      kb: Math.round(buf.length / 102.4) / 10,
      gzipKb: Math.round(gzipSync(buf).length / 102.4) / 10,
      inicial: iniciais.has(`assets/${f}`),
    };
  })
  .sort((a, b) => b.gzipKb - a.gzipKb);
const soma = (xs) => Math.round(xs.reduce((s, x) => s + x.gzipKb, 0) * 10) / 10;
const resumo = {
  medidoEm: new Date().toISOString(),
  inicialGzipKb: soma(arquivos.filter((a) => a.inicial)),
  totalGzipKb: soma(arquivos),
  maiores: arquivos.slice(0, 12),
};
mkdirSync("docs/performance", { recursive: true });
writeFileSync("docs/performance/bundle.json", JSON.stringify(resumo, null, 2) + "\n");
console.log(`inicial ${resumo.inicialGzipKb} kB gzip · total ${resumo.totalGzipKb} kB gzip`);
console.table(resumo.maiores);
