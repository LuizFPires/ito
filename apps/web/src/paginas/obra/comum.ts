/**
 * Detalhe da obra (PRD §3.2): tipos e funções compartilhados pelas 10 abas.
 */
import type { CustoMes, Movimentos, Obra, ResultadoObra, Soma, TipoHe } from "@ito/motor";
import { anoMes } from "@ito/motor";
import { mesAno } from "@ito/formato";
import type { ContextoCarga } from "../../dados/carga";
import type { DetalheObra } from "../../dados/obras";
import type { Visao } from "../../lib/obraDoBanco";

export const ABAS = [
  ["visao", "Visão geral"],
  ["efetivo", "Efetivo"],
  ["custos", "Custos"],
  ["he", "Horas extras"],
  ["folha", "Folha (rubricas)"],
  ["pessoas", "Pessoas"],
  ["aprop", "Apropriação"],
  ["ind", "Indicadores"],
  ["realoc", "MDO realocada"],
  ["prem", "Premissas"],
] as const;
export type Aba = (typeof ABAS)[number][0];

/** Funções em ordem alfabética (sem classificação por grupo, decisão de 23/10/2026). */
export const porNome = (fun: (id: string) => { nome: string }) => (a: string, b: string) =>
  fun(a).nome.localeCompare(fun(b).nome, "pt-BR");

export interface Vista {
  visao: Visao;
  caixa: boolean;
  eixo: "data" | "mes";
  agrupadas: boolean;
}

export interface FuncaoInfo {
  id: string;
  nome: string;
  cor: string;
  conta: string;
}

export interface DadosAba {
  d: DetalheObra;
  obra: Obra;
  movimentos: Movimentos;
  /** resultado na visão escolhida (época ou atualizado) */
  r: ResultadoObra;
  epoca: ResultadoObra;
  atual: ResultadoObra;
  rotulos: string[];
  fun: (id: string) => FuncaoInfo;
  /** funções com efetivo, em ordem de nome */
  ids: string[];
  vista: Vista;
  /** competência ou caixa */
  V: (c: CustoMes | Soma) => number;
  ctx: ContextoCarga;
  cidade: string;
  /** pode editar premissas e ver dados por matrícula */
  pode: boolean;
}

/** Componentes do custo (protótipo COMP), com a cor da paleta de séries. */
export const COMPONENTES = [
  { k: "salv", n: "Salário (horas normais)", c: "var(--c1)" },
  {
    k: "extras",
    n: "Adicionais (gratificação, prêmio, periculosidade, insalubridade, noturno, transferência)",
    c: "var(--c2)",
  },
  { k: "he", n: "Horas extras", c: "var(--c3)" },
  { k: "dsr", n: "Reflexo DSR das horas extras", c: "var(--c4)" },
  { k: "enc", n: "Encargos sociais", c: "var(--c5)" },
  { k: "prov", n: "Provisões (férias, 1/3, 13º, GRRF)", c: "var(--c6)" },
  { k: "vt", n: "Vale-transporte", c: "var(--c7)" },
  { k: "benef", n: "Benefícios", c: "var(--c8)" },
  { k: "exames", n: "Exames (admissionais, periódicos, demissionais)", c: "var(--c9)" },
  { k: "resc", n: "Rescisões", c: "var(--c10)" },
  { k: "ferr", n: "Ferramentas (verba indenizatória)", c: "var(--x1)" },
  { k: "nf", n: "Tributos s/ NF (prestadores)", c: "var(--c11)" },
  { k: "rl", n: "Risco, lucro e tributos s/ lucro", c: "var(--c12)" },
] as const;
export type ChaveComponente = (typeof COMPONENTES)[number]["k"];

/** Na visão caixa as provisões não saem no mês (são pagas depois). */
export const componentesVisiveis = (caixa: boolean) =>
  COMPONENTES.filter((c) => !(caixa && c.k === "prov"));

export function rotulosDe(obra: Obra, eixo: Vista["eixo"]): string[] {
  return Array.from({ length: obra.meses! }, (_, i) => {
    if (eixo === "mes") return `M${i + 1}`;
    const m = anoMes(obra.inicio, i);
    return mesAno(m.ano, m.mes);
  });
}

export const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export const notaVisao = (caixa: boolean) =>
  caixa
    ? "Visão caixa: adiantamento no mês, saldo da folha no mês seguinte, férias gozadas pagas quando acontecem e sem as provisões de férias, 1/3, 13º e GRRF, que são pagas depois."
    : "Visão competência: inclui as provisões de férias, 1/3, 13º e GRRF do mês.";

/** Plural simples para nomes de função ("Pedreiro" → "pedreiros"). */
export const plural = (nome: string) => {
  const n = nome.toLowerCase();
  return /[rzs]$/.test(n) ? `${n}es` : /l$/.test(n) ? `${n.slice(0, -1)}is` : `${n}s`;
};

export const NOME_HE: Record<TipoHe, string> = {
  util: "HE em dias úteis",
  sabado: "HE aos sábados",
  intervalo: "Intervalo intrajornada não concedido",
  feriado: "HE em domingos e feriados",
};

/** Gasto com HE cheia: horas × valor da hora com adicional, DSR, encargos e provisões. */
export const gastoHe = (c: CustoMes) => c.horasExtras * c.horaExtraCheia;
