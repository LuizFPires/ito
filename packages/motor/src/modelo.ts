/**
 * Modelo de entrada do motor (SPEC §1). Percentuais de 0 a 100, como na interface e no banco;
 * o motor converte para fração. Índice de mês relativo ao início (`mesIdx` 0..n−1).
 */
import type { Feriado, OpcoesCalendario } from "./calendario";
import type { ItemEncargo } from "./encargos";

export type Vinculo = "clt" | "estagio";
export type Regime = "clt" | "sp";
export type Origem = "local" | "diaria" | "aloj";
export type TipoHe = "util" | "sabado" | "intervalo" | "feriado";
export const TIPOS_HE: readonly TipoHe[] = ["util", "sabado", "intervalo", "feriado"];

export interface Funcao {
  id: string;
  vinculo: Vinculo;
  escalaArea: boolean;
  /** R$ por evento (admissional, demissional) e por ano (periódico) */
  exames: { adm: number; perAnual: number; dem: number };
  periculosidadePct: number;
  insalubridadePctSm: number;
  horasNoturnasMes: number;
  /** R$ por pessoa·mês (verba indenizatória) */
  ferramentasMes: number;
  /** fator sobre a HE média da obra (SPEC §4.3) */
  fatorHe: number;
}

export interface Beneficio {
  id: string;
  /** alojamento e viagens: só MO alojada (projeção) ou obra fora da sede (histórico) */
  soForaSede: boolean;
}

/** Tabela de preços e regras que vale num mês (SPEC §1.1 TabelaEmpresa + CCT + cidade). */
export interface Tabela {
  salarios: Readonly<Record<string, number>>;
  beneficios: Readonly<Record<string, number>>;
  /** gratificação fixa da CCT, R$ por pessoa·mês */
  gratificacoes: Readonly<Record<string, number>>;
  encargos: readonly ItemEncargo[];
  /** adicional de HE por tipo, 0–100 */
  heAdicionalPct: Readonly<Record<TipoHe, number>>;
  divisor: number;
  modoDias: "calendario" | "fixo";
  sabadoTrabalhado: boolean;
  diasFixos: number;
  dsrFixoPct: number;
  /** VT diário de referência (sem cidade) ou da cidade (tarifa × conduções × 2) */
  vtDiaria: number;
  fatorRescisao: number;
  salarioMinimo: number;
  adicionalNoturnoPct: number;
  salarioFamilia: { teto: number; cota: number };
}

export interface Premissas {
  gratPremiosPct: number;
  transfPct: number;
  funcoesTransferidas: readonly string[];
  riscoPct: number;
  lucroPct: number;
  tribLucroPct: number;
  /** histórico: obra fora da sede paga alojamento e viagens */
  foraDaSede: boolean;
  provisionar: boolean;
  adiantamento: boolean;
  adiantamentoPct: number;
}

export const PREMISSAS_PADRAO: Premissas = {
  gratPremiosPct: 3,
  transfPct: 25,
  funcoesTransferidas: [],
  riscoPct: 0,
  lucroPct: 0,
  tribLucroPct: 0,
  foraDaSede: false,
  provisionar: true,
  adiantamento: true,
  adiantamentoPct: 40,
};

/** Mix de HE por tipo em % (soma 100). Padrão do protótipo: 70/15/5/10. */
export const HE_MIX_PADRAO: Readonly<Record<TipoHe, number>> = {
  util: 70,
  sabado: 15,
  intervalo: 5,
  feriado: 10,
};

export interface InicioObra {
  ano: number;
  /** 1 a 12 */
  mes: number;
}

/** Uma obra (histórica ou montada pela projeção) no formato que o motor calcula. */
export interface Obra {
  id: string;
  inicio: InicioObra;
  /** número de meses; sem ele, a maior das séries (equivalente, HE, absenteísmo) */
  meses?: number;
  /** área construída (m²); usada pela projeção */
  area: number;
  /** pessoa-mês equivalente por função e mês */
  equivalente: Readonly<Record<string, readonly number[]>>;
  /** cabeças por função e mês (ausente: teto do equivalente) */
  cabecas?: Readonly<Record<string, readonly number[]>>;
  /** HE média por pessoa no mês (antes do fator da função) */
  heMedia: readonly number[];
  absenteismoPct: readonly number[];
  licencaPessoaDias: readonly number[];
  feriasPessoaDias: readonly number[];
  rotatividadePct: number;
  heMixPct?: Partial<Record<TipoHe, number>>;
  regime?: Readonly<Record<string, Regime>>;
  premissas?: Partial<Premissas>;
  feriadosMunicipais?: readonly Feriado[];
  /** projeção com cidade: origem da MO por função (alojada recebe alojamento e viagens) */
  origem?: Readonly<Record<string, Origem>>;
  /** VT diário por função (projeção com cidade, conforme a origem) */
  vtDiariaPorFuncao?: Readonly<Record<string, number>>;
}

/** Cadastros que valem para todo cálculo. */
export interface Contexto {
  funcoes: readonly Funcao[];
  beneficios: readonly Beneficio[];
  calendario: OpcoesCalendario;
}

/** Parâmetros por mês: uma tabela fixa ou uma por `mesIdx` (trocas de tabela, reajuste). */
export type ParametrosObra = Tabela | ((mesIdx: number) => Tabela);

export const tabelaDoMes = (p: ParametrosObra, i: number): Tabela =>
  typeof p === "function" ? p(i) : p;

/** Duração da obra em meses: `meses` ou a maior série — nunca trunca meses com efetivo. */
export function nMeses(o: Obra): number {
  if (o.meses !== undefined) return o.meses;
  let n = Math.max(o.heMedia.length, o.absenteismoPct.length);
  for (const v of Object.values(o.equivalente)) n = Math.max(n, v.length);
  return n;
}

/** Ano e mês (1–12) do `mesIdx` contado do início da obra. */
export function anoMes(inicio: InicioObra, mesIdx: number): { ano: number; mes: number } {
  const t = inicio.mes - 1 + mesIdx;
  return { ano: inicio.ano + Math.floor(t / 12), mes: (((t % 12) + 12) % 12) + 1 };
}
