/**
 * Parâmetros aplicados por mês (SPEC §3): época com trocas de tabela, cidade + CCT na
 * projeção e reajuste automático na data-base da CCT.
 */
import { anoMes } from "./modelo";
import type { InicioObra, ParametrosObra, Tabela } from "./modelo";
import { vtDiario } from "./local";
import type { CidadeVt } from "./local";

export interface TrocaTabela {
  mesIdx: number;
  /** data-base que passa a valer a partir de `mesIdx` */
  dataBase: number;
}

/**
 * Obra, época: começa na data-base da obra e muda nos meses das trocas.
 * Sem trocas, uma tabela só. Data-base desconhecida: usa a vigente.
 */
export function parametrosEpoca(
  tabelas: Readonly<Record<number, Tabela>>,
  dataBase: number,
  trocas: readonly TrocaTabela[],
  vigente: number,
): ParametrosObra {
  const tab = (ano: number) => tabelas[ano] ?? tabelas[vigente]!;
  const validas = trocas.filter((t) => tabelas[t.dataBase]).sort((a, b) => a.mesIdx - b.mesIdx);
  if (!validas.length) return tab(dataBase);
  return (i) => {
    let b = dataBase;
    for (const t of validas) if (i >= t.mesIdx) b = t.dataBase;
    return tab(b);
  };
}

export interface CctPrecos {
  /** 1 a 12 */
  mesDataBase: number;
  reajusteEstimadoPct: number;
  salarios: Readonly<Record<string, number>>;
  gratificacoes: Readonly<Record<string, number>>;
  beneficios: Readonly<Record<string, number>>;
}

export interface CidadePrecos extends CidadeVt {
  issPct: number;
}

/**
 * Projeção com cidade (SPEC §3): tabela vigente + salários, benefícios e gratificações da CCT,
 * VT diário da cidade e ISS (alíquota S/P) da cidade. O que a CCT não define fica o da empresa.
 */
export function tabelaDaCidade(vigente: Tabela, cct: CctPrecos, cidade: CidadePrecos): Tabela {
  return {
    ...vigente,
    salarios: { ...vigente.salarios, ...cct.salarios },
    beneficios: { ...vigente.beneficios, ...cct.beneficios },
    gratificacoes: { ...cct.gratificacoes },
    vtDiaria: vtDiario(cidade),
    encargos: vigente.encargos.map((e) => (e.id === "iss" ? { ...e, aliqSp: cidade.issPct } : e)),
  };
}

export interface Reajuste {
  mesIdx: number;
  pct: number;
  automatico: boolean;
}

/**
 * Reajuste da projeção: informado (pct ≠ 0) ou automático = primeiro mês i ≥ 1 cujo mês do
 * calendário é o da data-base da CCT, com o reajuste estimado dela.
 */
export function reajusteDaProjecao(
  inicio: InicioObra,
  prazo: number,
  informado: { mesIdx: number; pct: number } | null | undefined,
  cct: Pick<CctPrecos, "mesDataBase" | "reajusteEstimadoPct"> | null | undefined,
): Reajuste | null {
  if (informado && Number(informado.pct))
    return { mesIdx: informado.mesIdx, pct: informado.pct, automatico: false };
  if (!cct) return null;
  for (let i = 1; i < prazo; i++) {
    if (anoMes(inicio, i).mes === cct.mesDataBase)
      return { mesIdx: i, pct: cct.reajusteEstimadoPct, automatico: true };
  }
  return null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

function reajustar(t: Tabela, pct: number): Tabela {
  const f = 1 + pct / 100;
  const vezes = (m: Readonly<Record<string, number>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, centavos(v * f)]));
  return {
    ...t,
    salarios: vezes(t.salarios),
    beneficios: vezes(t.beneficios),
    gratificacoes: vezes(t.gratificacoes),
  };
}

/** A partir do mês do reajuste, salários, benefícios e gratificações × (1 + pct). */
export function aplicarReajuste(
  base: Tabela,
  prazo: number,
  reajuste: Reajuste | null,
): ParametrosObra {
  if (!reajuste || !reajuste.pct || reajuste.mesIdx >= prazo) return base;
  const depois = reajustar(base, reajuste.pct);
  return (i) => (i >= reajuste.mesIdx ? depois : base);
}

/** Salário da função na tabela; sem salário, o do oficial (pedreiro), como no protótipo. */
export function salarioDe(t: Tabela, funcaoId: string): number {
  return t.salarios[funcaoId] ?? t.salarios.ped ?? 0;
}
