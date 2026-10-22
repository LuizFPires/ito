/**
 * Admissões e desligamentos sintéticos (SPEC §4.6) — só para projeções e dados sintéticos;
 * no histórico real vêm da folha. Sorteio determinístico igual ao do protótipo (decisão M3).
 */
import type { Obra } from "./modelo";
import { nMeses } from "./modelo";

/** Número em [0, 1) a partir do texto, por hash FNV-1a 32 bits (igual ao protótipo). */
export function aleatorioDeterministico(semente: string): number {
  let h = 2166136261;
  for (const c of semente) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Cabeças da função no mês; sem dado, o teto do equivalente. */
export function cabecasMes(o: Obra, funcaoId: string, i: number): number {
  const c = o.cabecas?.[funcaoId];
  return c ? (c[i] ?? 0) : Math.ceil(o.equivalente[funcaoId]?.[i] ?? 0);
}

export interface Movimentos {
  admissoes: Record<string, number[]>;
  desligamentos: Record<string, number[]>;
}

/**
 * e = cab_i × rotatividade (i > 0 e cab_i > 0); churn = ⌊e⌋ + (sorteio < frac(e) ? 1 : 0)
 * adm_i = máx(0, cab_i − cab_{i−1}) + churn; dem_i = máx(0, cab_{i−1} − cab_i) + churn
 * No último mês, desmobilização: + 50% das cabeças nos desligamentos.
 */
export function movimentos(o: Obra, funcoes: readonly string[]): Movimentos {
  const n = nMeses(o);
  const admissoes: Record<string, number[]> = {};
  const desligamentos: Record<string, number[]> = {};
  for (const k of funcoes) {
    const ad: number[] = [];
    const de: number[] = [];
    for (let i = 0; i < n; i++) {
      const anterior = i ? cabecasMes(o, k, i - 1) : 0;
      const atual = cabecasMes(o, k, i);
      const e = i && atual ? (atual * o.rotatividadePct) / 100 : 0;
      const churn =
        Math.floor(e) + (aleatorioDeterministico(`${o.id || "p"}${k}${i}`) < e % 1 ? 1 : 0);
      ad.push(Math.max(0, atual - anterior) + churn);
      let d = Math.max(0, anterior - atual) + churn;
      if (i === n - 1) d += Math.round(atual * 0.5);
      de.push(d);
    }
    admissoes[k] = ad;
    desligamentos[k] = de;
  }
  return { admissoes, desligamentos };
}
