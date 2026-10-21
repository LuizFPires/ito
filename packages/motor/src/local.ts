/**
 * Preços que dependem do lugar da obra (SPEC §1.1, §3 e §4.4): VT diário e feriados municipais.
 */
import type { Feriado } from "./calendario";

export interface CidadeVt {
  id: string;
  /** R$ por condução */
  tarifaLocal: number;
  /** conduções por trajeto */
  conducoes: number;
  /** R$ por trajeto para quem vem de outra cidade (chave = id da cidade de origem) */
  passagens: Readonly<Record<string, number>>;
}

/** VT diário da MO local: tarifa × conduções × 2 (ida e volta). */
export function vtDiario(c: CidadeVt): number {
  return c.tarifaLocal * c.conducoes * 2;
}

/**
 * VT diário de quem vem todo dia de `origem` para trabalhar em `obra`.
 * Passagem cadastrada → passagem × 2. Sem passagem → estimado: (tarifa da obra + tarifa da origem) × 2.
 */
export function vtDiarioDe(obra: CidadeVt, origem: CidadeVt): { valor: number; estimado: boolean } {
  if (obra.id === origem.id) return { valor: vtDiario(obra), estimado: false };
  const passagem = Number(obra.passagens[origem.id] ?? 0);
  if (passagem > 0) return { valor: passagem * 2, estimado: false };
  return { valor: (obra.tarifaLocal + origem.tarifaLocal) * 2, estimado: true };
}

export interface FeriadoRecorrente {
  dia: number;
  /** 1 a 12 */
  mes: number;
  nome: string;
}

/** Feriados municipais recorrentes (dia/mês) com a data de `ano`. Datas inexistentes ficam de fora. */
export function feriadosDaCidade(fer: readonly FeriadoRecorrente[], ano: number): Feriado[] {
  return fer
    .filter((f) => {
      const d = new Date(Date.UTC(ano, f.mes - 1, f.dia));
      return d.getUTCMonth() === f.mes - 1 && d.getUTCDate() === f.dia;
    })
    .map((f) => ({
      data: `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`,
      nome: f.nome,
    }))
    .sort((x, y) => x.data.localeCompare(y.data));
}
