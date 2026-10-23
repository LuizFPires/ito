/**
 * Cálculo da obra inteira: custo por função e mês, caixa com adiantamento (SPEC §4.5) e
 * agregações por mês e total.
 */
import { custoFuncaoMes, premissasDe } from "./custo";
import type { CustoMes } from "./custo";
import type { Contexto, Obra, ParametrosObra } from "./modelo";
import { TIPOS_HE, nMeses } from "./modelo";
import { movimentos } from "./movimentos";
import type { Movimentos } from "./movimentos";

/** Campos numéricos somáveis de um custo (para totais do mês e da obra). */
export const CAMPOS_SOMAVEIS = [
  "x",
  "xa",
  "pres",
  "bruto",
  "faltasH",
  "faltasD",
  "faltas",
  "salv",
  "bolsa",
  "extras",
  "horasExtras",
  "he",
  "dsr",
  "remun",
  "enc",
  "prov",
  "nf",
  "vtBruto",
  "vtDesc",
  "vt",
  "benef",
  "admissoes",
  "desligamentos",
  "exames",
  "resc",
  "ferr",
  "salFam",
  "ferPag",
  "sub",
  "rl",
  "total",
  "caixa",
  "dias",
  "licD",
  "ferD",
  "cabecas",
] as const;
export type CampoSomavel = (typeof CAMPOS_SOMAVEIS)[number];

export type Soma = Record<CampoSomavel, number> & {
  adicionais: Record<string, number>;
  heTipo: Record<string, number>;
  beneficiosItem: Record<string, number>;
  examesTipo: Record<string, number>;
  /** saldo da folha que vai para o caixa do mês seguinte (adiantamento) */
  saldoFolha: number;
};

export interface CustoMesObra extends CustoMes {
  saldoFolha: number;
}

export interface ResultadoObra {
  n: number;
  movimentos: Movimentos;
  /** funções com efetivo na obra */
  funcoes: string[];
  porFuncao: Record<string, CustoMesObra[]>;
  porMes: Soma[];
  total: Soma;
}

const somaVazia = (): Soma => {
  const s = Object.fromEntries(CAMPOS_SOMAVEIS.map((k) => [k, 0])) as Record<CampoSomavel, number>;
  return { ...s, adicionais: {}, heTipo: {}, beneficiosItem: {}, examesTipo: {}, saldoFolha: 0 };
};

function acumular(alvo: Record<string, number>, de: Record<string, number>) {
  for (const [k, v] of Object.entries(de)) alvo[k] = (alvo[k] ?? 0) + v;
}

export function somar(lista: readonly (CustoMesObra | Soma)[]): Soma {
  const r = somaVazia();
  for (const c of lista) {
    for (const k of CAMPOS_SOMAVEIS) r[k] += c[k];
    acumular(r.adicionais, c.adicionais as unknown as Record<string, number>);
    acumular(r.heTipo, c.heTipo);
    acumular(r.beneficiosItem, c.beneficiosItem);
    acumular(r.examesTipo, c.examesTipo);
    r.saldoFolha += c.saldoFolha;
  }
  return r;
}

export interface OpcoesObra {
  /**
   * Admissões e desligamentos: os da folha (histórico real) ou "sinteticos" (§4.6, só para
   * projeções e dados sintéticos). Obrigatório para o histórico não cair no sintético sem querer.
   */
  movimentos: Movimentos | "sinteticos";
}

/** Erro de entrada do motor, com a ação a tomar. */
export class ErroEntradaMotor extends Error {}

const ruim = (v: number) => !Number.isFinite(v) || v < 0;

/**
 * Problemas de entrada que o cálculo não pode engolir em silêncio (NaN, negativos, percentuais
 * fora de 0–100, mix de HE que não soma 100). Lista vazia: entrada válida.
 */
export function validarObra(o: Obra): string[] {
  const erros: string[] = [];
  if (!Number.isInteger(o.inicio.mes) || o.inicio.mes < 1 || o.inicio.mes > 12)
    erros.push(`Mês de início ${o.inicio.mes} inválido: informe de 1 a 12.`);
  if (o.meses !== undefined && (!Number.isInteger(o.meses) || o.meses < 0))
    erros.push(`Número de meses ${o.meses} inválido: informe um inteiro ≥ 0.`);
  if (ruim(o.area)) erros.push("Área inválida: informe a área construída em m² (≥ 0).");
  for (const [k, v] of Object.entries(o.equivalente))
    if (v.some(ruim))
      erros.push(`Pessoa-mês de ${k} com valor negativo ou vazio: corrija a série.`);
  for (const [k, v] of Object.entries(o.cabecas ?? {}))
    if (v.some(ruim)) erros.push(`Cabeças de ${k} com valor negativo ou vazio: corrija a série.`);
  const series: [string, readonly number[]][] = [
    ["HE média", o.heMedia],
    ["Licenças", o.licencaPessoaDias],
    ["Férias", o.feriasPessoaDias],
  ];
  for (const [nome, v] of series)
    if (v.some(ruim)) erros.push(`${nome} com valor negativo ou vazio: corrija a série.`);
  if (o.absenteismoPct.some((v) => ruim(v) || v > 100))
    erros.push("Absenteísmo fora de 0–100%: corrija a série.");
  if (ruim(o.rotatividadePct) || o.rotatividadePct > 100)
    erros.push("Rotatividade fora de 0–100%: corrija a premissa.");
  if (o.heMixPct) {
    const mix = TIPOS_HE.map((t) => o.heMixPct?.[t] ?? 0);
    const soma = mix.reduce((a, b) => a + b, 0);
    if (mix.some(ruim) || Math.abs(soma - 100) > 0.01)
      erros.push(`Mix de HE soma ${soma}%: ajuste os tipos para somar 100%.`);
  }
  return erros;
}

export function calcularObra(
  o: Obra,
  p: ParametrosObra,
  ctx: Contexto,
  op: OpcoesObra,
): ResultadoObra {
  const erros = validarObra(o);
  if (erros.length) throw new ErroEntradaMotor(`Obra ${o.id}: ${erros.join(" ")}`);
  const n = nMeses(o);
  const todas = ctx.funcoes.map((f) => f.id);
  // Toda função com efetivo precisa estar no cadastro (inclusive as inativas): nada some do custo.
  const desconhecidas = Object.entries(o.equivalente)
    .filter(([k, v]) => v.some((x) => x > 0) && !todas.includes(k))
    .map(([k]) => k);
  if (desconhecidas.length)
    throw new ErroEntradaMotor(
      `Funções sem cadastro na obra ${o.id}: ${desconhecidas.join(", ")}. Inclua-as (mesmo inativas) nas funções do cálculo.`,
    );
  const mov = op.movimentos === "sinteticos" ? movimentos(o, todas) : op.movimentos;
  const comEfetivo = ctx.funcoes.filter((f) => (o.equivalente[f.id] ?? []).some((v) => v > 0));
  const pr = premissasDe(o);

  const porFuncao: Record<string, CustoMesObra[]> = {};
  for (const f of comEfetivo) {
    const linha: CustoMesObra[] = Array.from({ length: n }, (_, i) => ({
      ...custoFuncaoMes(o, f, i, p, ctx, {
        admissoes: mov.admissoes[f.id]?.[i] ?? 0,
        desligamentos: mov.desligamentos[f.id]?.[i] ?? 0,
      }),
      saldoFolha: 0,
    }));
    // §4.5 caixa: adiantamento no próprio mês; o saldo da folha sai no mês seguinte
    if (pr.adiantamento) {
      const ap = pr.adiantamentoPct / 100;
      const remun = linha.map((c) => c.remun);
      linha.forEach((c, i) => {
        const sai = i < n - 1 ? remun[i]! * (1 - ap) : 0;
        const entra = i ? remun[i - 1]! * (1 - ap) : 0;
        c.caixa += entra - sai;
        c.saldoFolha = sai;
      });
    }
    porFuncao[f.id] = linha;
  }

  const porMes = Array.from({ length: n }, (_, i) =>
    somar(comEfetivo.map((f) => porFuncao[f.id]![i]!)),
  );
  return {
    n,
    movimentos: mov,
    funcoes: comEfetivo.map((f) => f.id),
    porFuncao,
    porMes,
    total: somar(porMes),
  };
}

/** Indicadores derivados (SPEC §4.7). Divisão por zero dá 0. */
export interface Indicadores {
  /** R$ por dia trabalhado, com taxa (total) e sem taxa (remuneração) */
  porDiaComTaxa: number;
  porDiaSemTaxa: number;
  /** (enc + prov + nf) ÷ remun, 0–100 */
  encargosPct: number;
  /** (VT + benef) ÷ remun, 0–100 */
  beneficiosPct: number;
}

const razao = (a: number, b: number) => (b ? a / b : 0);

export function indicadores(r: ResultadoObra): Indicadores {
  const t = r.total;
  return {
    porDiaComTaxa: razao(t.total, t.dias),
    porDiaSemTaxa: razao(t.remun, t.dias),
    encargosPct: razao(t.enc + t.prov + t.nf, t.remun) * 100,
    beneficiosPct: razao(t.vt + t.benef, t.remun) * 100,
  };
}
