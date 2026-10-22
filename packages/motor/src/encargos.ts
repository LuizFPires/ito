/**
 * Encargos e provisões da tabela da empresa (SPEC §1.1 e §4.4).
 * Itens guardam percentuais de 0 a 100 (como na interface); as taxas saem em fração.
 */

export type GrupoEncargo = "soc" | "prov" | "nf";

export interface ItemEncargo {
  id: string;
  grupo: GrupoEncargo;
  nome: string;
  /** base de cálculo, 0 a 100 */
  baseCalcPct: number;
  /** alíquota CLT, 0 a 100 */
  aliqClt: number;
  /** alíquota prestador S/P, 0 a 100 */
  aliqSp: number;
}

export interface TaxaPorRegime {
  clt: number;
  sp: number;
}

export interface TaxasEncargos {
  /** encargos sociais, já com a incidência sobre férias + 1/3 + 13º */
  soc: TaxaPorRegime;
  /** férias 1/12 + 1/3 + 13º 1/12 + GRRF */
  prov: TaxaPorRegime;
  /** tributos sobre NF (S/P) */
  nf: TaxaPorRegime;
  /** parte de `soc` que é incidência: soc_base × (férias + 1/3 + 13º) */
  incidencia: TaxaPorRegime;
}

/** Itens de provisão sobre os quais incidem os encargos sociais. */
export const IDS_INCIDENCIA = ["ferias", "terco", "dec"] as const;

const zero = (): TaxaPorRegime => ({ clt: 0, sp: 0 });

export function taxasEncargos(itens: readonly ItemEncargo[]): TaxasEncargos {
  const t = { soc: zero(), prov: zero(), nf: zero(), incidencia: zero() };
  const base = { clt: 0, sp: 0 };
  for (const it of itens) {
    const fator = it.baseCalcPct / 100;
    t[it.grupo].clt += (fator * it.aliqClt) / 100;
    t[it.grupo].sp += (fator * it.aliqSp) / 100;
    if ((IDS_INCIDENCIA as readonly string[]).includes(it.id)) {
      base.clt += (fator * it.aliqClt) / 100;
      base.sp += (fator * it.aliqSp) / 100;
    }
  }
  for (const r of ["clt", "sp"] as const) {
    t.incidencia[r] = t.soc[r] * base[r];
    t.soc[r] += t.incidencia[r];
  }
  return t;
}

/** Itens de referência da tabela da empresa (AF v07, CCT 2026). */
export const ENCARGOS_REFERENCIA: readonly ItemEncargo[] = [
  { id: "inss", grupo: "soc", nome: "INSS", baseCalcPct: 100, aliqClt: 20, aliqSp: 0 },
  {
    id: "sat",
    grupo: "soc",
    nome: "Seguro acidente de trabalho (SAT)",
    baseCalcPct: 100,
    aliqClt: 3,
    aliqSp: 0,
  },
  { id: "fgts", grupo: "soc", nome: "FGTS", baseCalcPct: 100, aliqClt: 8, aliqSp: 0 },
  { id: "sesi", grupo: "soc", nome: "SESI / SESC", baseCalcPct: 100, aliqClt: 1.5, aliqSp: 0 },
  { id: "senai", grupo: "soc", nome: "SENAI / SENAC", baseCalcPct: 100, aliqClt: 1, aliqSp: 0 },
  {
    id: "saled",
    grupo: "soc",
    nome: "Salário-educação",
    baseCalcPct: 100,
    aliqClt: 2.5,
    aliqSp: 0,
  },
  { id: "incra", grupo: "soc", nome: "INCRA", baseCalcPct: 100, aliqClt: 0.2, aliqSp: 0 },
  { id: "sebrae", grupo: "soc", nome: "SEBRAE", baseCalcPct: 100, aliqClt: 0.6, aliqSp: 0 },
  { id: "seconci", grupo: "soc", nome: "SECONCI", baseCalcPct: 100, aliqClt: 0, aliqSp: 0 },
  { id: "ferias", grupo: "prov", nome: "Férias", baseCalcPct: 100, aliqClt: 8.3333, aliqSp: 0 },
  {
    id: "terco",
    grupo: "prov",
    nome: "1/3 de férias",
    baseCalcPct: 100,
    aliqClt: 2.7778,
    aliqSp: 0,
  },
  { id: "dec", grupo: "prov", nome: "13º salário", baseCalcPct: 100, aliqClt: 8.3333, aliqSp: 0 },
  {
    id: "grrf",
    grupo: "prov",
    nome: "Multa do FGTS (GRRF)",
    baseCalcPct: 8,
    aliqClt: 40,
    aliqSp: 0,
  },
  { id: "iss", grupo: "nf", nome: "ISSQN", baseCalcPct: 100, aliqClt: 0, aliqSp: 3 },
  { id: "pis", grupo: "nf", nome: "PIS", baseCalcPct: 100, aliqClt: 0, aliqSp: 0.65 },
  { id: "cofins", grupo: "nf", nome: "COFINS", baseCalcPct: 100, aliqClt: 0, aliqSp: 3 },
  {
    id: "cprb",
    grupo: "nf",
    nome: "Contrib. previdenciária s/ receita bruta",
    baseCalcPct: 100,
    aliqClt: 0,
    aliqSp: 0,
  },
];
