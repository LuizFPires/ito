/**
 * Medição do custo do motor por tamanho (M12, baseline). Fora da suíte de testes; uso, na raiz:
 *
 *   pnpm perf:motor
 *
 * Projeção com 5, 23, 100 e 1.000 referências (prazos de 9 e 36 meses), os cenários de origem e
 * o cálculo de uma obra. Referências = as obras de exemplo do protótipo repetidas (só matrícula).
 * Grava docs/performance/motor.json e imprime a tabela.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Obra } from "./modelo";
import { calcularObra } from "./obra";
import { cenariosDeOrigem, projetar } from "./projecao";
import {
  carregarPrototipo,
  contextoDe,
  entradaProjecaoDe,
  obraDe,
  tabelaDe,
} from "./prototipo.harness";

const P = carregarPrototipo();
const ctx = contextoDe(P);
const tabela = tabelaDe(P.pVig());
/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados do protótipo */
const base = P.D.projecoes.find((p: any) => p.cidade);
const exemplos: Obra[] = (P.D.obras as unknown[]).map((o) => obraDe(P, o));

const referencias = (n: number): Obra[] =>
  Array.from({ length: n }, (_, i) => ({ ...exemplos[i % exemplos.length]!, id: `ref_${i}` }));

/** Mediana e p95 de `vezes` execuções (depois de aquecer). */
function medir(fn: () => unknown, vezes: number) {
  for (let i = 0; i < 3; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < vezes; i++) {
    const t0 = performance.now();
    fn();
    t.push(performance.now() - t0);
  }
  t.sort((a, b) => a - b);
  const q = (p: number) =>
    Math.round(t[Math.min(t.length - 1, Math.floor(p * t.length))]! * 10) / 10;
  return { mediana: q(0.5), p95: q(0.95) };
}

const linhas: { caso: string; mediana: number; p95: number }[] = [];
for (const prazo of [9, 36])
  for (const n of [5, 23, 100, 1000]) {
    const e = { ...entradaProjecaoDe(P, { ...base, prazo }), referencias: referencias(n) };
    const vezes = n >= 1000 ? 10 : 30;
    linhas.push({
      caso: `projeção ${prazo} meses · ${n} referências`,
      ...medir(() => projetar(e, tabela, ctx), vezes),
    });
    linhas.push({
      caso: `cenários de origem ${prazo} meses · ${n} referências`,
      ...medir(() => cenariosDeOrigem(e, tabela, ctx), n >= 1000 ? 5 : 15),
    });
  }
for (const prazo of [9, 36]) {
  const r = projetar(
    { ...entradaProjecaoDe(P, { ...base, prazo }), referencias: referencias(23) },
    tabela,
    ctx,
  )!;
  linhas.push({
    caso: `obra ${prazo} meses (calcularObra)`,
    ...medir(() => calcularObra(r.obra, tabela, ctx, { movimentos: "sinteticos" }), 50),
  });
}

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = join(aqui, "../../../docs/performance/motor.json");
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(
  saida,
  JSON.stringify({ medidoEm: new Date().toISOString(), node: process.version, linhas }, null, 2) +
    "\n",
);
console.table(linhas);
