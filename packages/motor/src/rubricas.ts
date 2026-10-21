/**
 * Rubricas da folha (SPEC §6.1 e §7): gerador de referência a partir dos componentes do mês e
 * conferência rubricas × custo do ITO (regra 4: fecha no centavo).
 */
import type { Soma } from "./obra";

export type TipoRubrica = "provento" | "desconto" | "informativo";
export type ComponenteRubrica =
  | "sal"
  | "extras"
  | "he"
  | "dsr"
  | "faltas"
  | "resc"
  | "ferr"
  | "provpaga"
  | "compgps"
  | "nao"
  | "info";

export interface RubricaDicionario {
  codigo: number;
  tipo: TipoRubrica;
  componente: ComponenteRubrica;
}

/** Componentes que NÃO entram no custo (SPEC §6.1). */
export const FORA_DO_CUSTO: readonly ComponenteRubrica[] = ["nao", "info", "provpaga", "compgps"];

const ad = (m: Soma, k: string) => m.adicionais[k] ?? 0;
const heT = (m: Soma, k: string) => m.heTipo[k] ?? 0;
const ben = (m: Soma, k: string) => m.beneficiosItem[k] ?? 0;

/**
 * Valor de cada rubrica de referência no mês (SPEC §7 / gerador do protótipo).
 * `comMulta479` = o dicionário tem a rubrica 8792 (parte da multa da rescisão vai para ela).
 */
export function geradorRubricas(
  comMulta479: boolean,
): Readonly<Record<number, (m: Soma) => number>> {
  return {
    1: (m) => m.salv + m.faltas - m.bolsa,
    300: (m) => m.bolsa,
    20: (m) => ad(m, "grat") * 0.53 + ad(m, "gratF"),
    2126: (m) => ad(m, "grat") * 0.35,
    2127: (m) => ad(m, "grat") * 0.12,
    149: (m) => ad(m, "peric"),
    155: (m) => ad(m, "insal"),
    160: (m) => ad(m, "not"),
    161: (m) => ad(m, "dsrNot"),
    170: (m) => ad(m, "transf"),
    200: (m) => heT(m, "util"),
    201: (m) => heT(m, "sabado"),
    205: (m) => heT(m, "intervalo"),
    210: (m) => heT(m, "feriado"),
    250: (m) => m.dsr * 0.92,
    251: (m) => m.dsr * 0.05,
    252: (m) => m.dsr * 0.03,
    310: (m) => m.ferr,
    400: (m) => m.ferPag * 0.75,
    401: (m) => m.ferPag * 0.25,
    320: (m) => m.salFam,
    980: (m) => m.salv * 0.4,
    990: (m) => m.cabecas * 0.37,
    40: (m) => -m.faltasH,
    42: (m) => -m.faltasD,
    8697: () => 0,
    29: (m) => m.resc * 0.32,
    8169: (m) => m.resc * 0.11,
    8550: (m) => m.resc * 0.32,
    831: (m) => m.resc * (comMulta479 ? 0.19 : 0.25),
    8792: (m) => m.resc * 0.06,
    51: (m) => m.resc * 0.78,
    981: (m) => m.salv * 0.4,
    998: (m) => -m.remun * 0.09,
    999: (m) => -m.remun * 0.022,
    2003: (m) => -m.vtDesc,
    2005: (m) => -ben(m, "cesta") * 0.1,
    2505: (m) => -ben(m, "cafe") * 0.2,
    2402: (m) => -m.remun * 0.01,
  };
}

export interface ValorRubrica {
  codigo: number;
  valor: number;
}

/** Rubricas do mês para as rubricas do dicionário que têm gerador. */
export function gerarRubricasMes(
  mes: Soma,
  dicionario: readonly RubricaDicionario[],
): ValorRubrica[] {
  const g = geradorRubricas(dicionario.some((r) => r.codigo === 8792));
  return dicionario
    .filter((r) => g[r.codigo])
    .map((r) => ({ codigo: r.codigo, valor: g[r.codigo]!(mes) }));
}

export interface ConferenciaMes {
  /** Σ rubricas que entram no custo */
  rubricas: number;
  /** remun + resc + ferr */
  custo: number;
  diferenca: number;
  /** diferença abaixo de R$ 1 (SPEC §6.1) */
  confere: boolean;
  proventos: number;
  descontos: number;
  liquido: number;
}

/** Conferência rubricas × custo do ITO, por mês (SPEC §6.1). */
export function conferirFolha(
  porMes: readonly Soma[],
  dicionario: readonly RubricaDicionario[],
): ConferenciaMes[] {
  const porCodigo = new Map(dicionario.map((r) => [r.codigo, r]));
  return porMes.map((m) => {
    let rubricas = 0;
    let proventos = 0;
    let descontos = 0;
    for (const { codigo, valor } of gerarRubricasMes(m, dicionario)) {
      const r = porCodigo.get(codigo)!;
      if (!FORA_DO_CUSTO.includes(r.componente)) rubricas += valor;
      if (r.tipo === "provento") proventos += valor;
      if (r.tipo === "desconto") descontos += valor;
    }
    const custo = m.remun + m.resc + m.ferr;
    const diferenca = rubricas - custo;
    return {
      rubricas,
      custo,
      diferenca,
      confere: Math.abs(diferenca) < 1,
      proventos,
      descontos,
      liquido: proventos + descontos,
    };
  });
}
