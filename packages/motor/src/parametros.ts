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
 * Reajustes da projeção (SPEC §3, decisão M3):
 * - informado (não nulo) vale como está — inclusive 0%, que significa "sem reajuste";
 * - automático (nulo) = cada mês i ≥ 1 do prazo cujo mês do calendário é o da data-base da CCT,
 *   com o reajuste estimado dela. Obras longas recebem um reajuste por ano, composto.
 */
export function reajustesDaProjecao(
  inicio: InicioObra,
  prazo: number,
  informado: { mesIdx: number; pct: number } | null | undefined,
  cct: Pick<CctPrecos, "mesDataBase" | "reajusteEstimadoPct"> | null | undefined,
): Reajuste[] {
  if (informado != null)
    return Number(informado.pct)
      ? [{ mesIdx: informado.mesIdx, pct: informado.pct, automatico: false }]
      : [];
  if (!cct || !cct.reajusteEstimadoPct) return [];
  const lista: Reajuste[] = [];
  for (let i = 1; i < prazo; i++) {
    if (anoMes(inicio, i).mes === cct.mesDataBase)
      lista.push({ mesIdx: i, pct: cct.reajusteEstimadoPct, automatico: true });
  }
  return lista;
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

/**
 * A partir de cada reajuste, salários, benefícios e gratificações × (1 + pct), em centavos;
 * reajustes seguidos se compõem (1.400 → 1.484 → 1.573,04).
 */
export function aplicarReajustes(
  base: Tabela,
  prazo: number,
  reajustes: readonly Reajuste[],
): ParametrosObra {
  const validos = reajustes
    .filter((r) => r.pct && r.mesIdx > 0 && r.mesIdx < prazo)
    .sort((x, y) => x.mesIdx - y.mesIdx);
  if (!validos.length) return base;
  const etapas: { desde: number; tabela: Tabela }[] = [{ desde: 0, tabela: base }];
  for (const r of validos)
    etapas.push({ desde: r.mesIdx, tabela: reajustar(etapas[etapas.length - 1]!.tabela, r.pct) });
  return (i) => {
    let t = base;
    for (const e of etapas) if (i >= e.desde) t = e.tabela;
    return t;
  };
}

export type OrigemSalario = "tabela" | "oficial" | "ausente";

/**
 * Salário da função na tabela; sem salário, o do oficial (pedreiro), como no protótipo.
 * A origem fica no custo para a tela avisar quando não veio da tabela.
 */
export function salarioComOrigem(
  t: Tabela,
  funcaoId: string,
): { valor: number; origem: OrigemSalario } {
  const v = t.salarios[funcaoId];
  if (v !== undefined) return { valor: v, origem: "tabela" };
  const ped = t.salarios.ped;
  return ped !== undefined ? { valor: ped, origem: "oficial" } : { valor: 0, origem: "ausente" };
}

export function salarioDe(t: Tabela, funcaoId: string): number {
  return salarioComOrigem(t, funcaoId).valor;
}
