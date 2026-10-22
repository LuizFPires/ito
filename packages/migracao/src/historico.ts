/**
 * Planilha histórica lida (M9), já sem nomes de pessoas: uma linha por matrícula e competência,
 * com as rubricas em códigos do ITO. Os dois modelos (.xlsm v04–v20 e .xlsb) chegam aqui.
 */
import type { Competencia, Construtora } from "@ito/carga";

export type Modelo = "xlsm" | "xlsb";

export interface RubricaLida {
  codigo: number;
  descricao: string;
  /** horas ou dias (nas HE, as horas; estimadas no .xlsb) */
  referencia: number;
  valor: number;
}

export interface LinhaHistorico {
  comp: Competencia;
  matricula: string;
  construtora: Construtora;
  /** função como está na planilha */
  funcao: string;
  /** classe da planilha (só no .xlsm): ajuda quando o texto da função não diz nada */
  classe?: string;
  /** dias de vínculo no mês; null = mês cheio */
  dias: number | null;
  admitido: boolean;
  desligado: boolean;
  licencaDias: number;
  feriasDias: number;
  faltasHoras: number;
  /** MDO realocada (trabalhou em outra obra) */
  realocada: boolean;
  /** crédito de VT do mês (R$), quando a planilha traz */
  vt: number | null;
  rubricas: RubricaLida[];
}

export interface Aviso {
  tipo: "estimado" | "ignorado" | "conferencia" | "atencao";
  texto: string;
}

export interface PlanilhaHistorica {
  arquivo: string;
  modelo: Modelo;
  construtora: Construtora;
  /** título da obra na planilha ("OBRA MART MINAS UBÁ") */
  titulo: string;
  /** início da obra (dia 1 do mês, como o ITO guarda) */
  inicio: Competencia | null;
  feriados: { data: string; nome: string }[];
  linhas: LinhaHistorico[];
  /** total de proventos por competência (da própria planilha, para conferir) */
  proventos: { comp: Competencia; valor: number }[];
  /** rubricas do .xlsb sem cadastro no ITO: classificação sugerida pelo nome */
  rubricasNovas: { codigo: number; descricao: string; sinal: "+" | "-" | "" }[];
  avisos: Aviso[];
}

/** Valor de célula (os dois leitores devolvem estes tipos). */
export type Celula = string | number | boolean | Date | null | undefined;
export type Abas = Readonly<Record<string, readonly (readonly Celula[] | undefined)[]>>;

/** Texto sem acento, minúsculo e com espaços simples (para achar colunas pelo nome). */
export const normal = (v: Celula) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const numero = (v: Celula): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Data do Excel (serial ou Date) → competência. */
export function competenciaDe(v: Celula): Competencia | null {
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number" && v > 20000 && v < 80000)
    d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
  if (!d || Number.isNaN(d.getTime())) return null;
  // datas do read-excel-file vêm em UTC; o dia não importa para a competência
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

export function dataIso(v: Celula): string | null {
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number" && v > 20000 && v < 80000)
    d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Índice das colunas de um cabeçalho em duas linhas (grupo mesclado + subtítulo): "grupo|sub".
 * Células mescladas vêm vazias depois da primeira: o grupo é repetido para a direita.
 */
export function indiceColunas(
  grupo: readonly Celula[],
  sub: readonly Celula[],
): { nome: string; col: number }[] {
  const n = Math.max(grupo.length, sub.length);
  const cols: { nome: string; col: number }[] = [];
  let atual = "";
  for (let c = 0; c < n; c++) {
    const g = normal(grupo[c]);
    if (g) atual = g;
    const s = normal(sub[c]);
    if (!atual && !s) continue;
    cols.push({ nome: s ? `${atual}|${s}` : atual, col: c });
  }
  return cols;
}

/** Primeira coluna cujo nome começa com algum dos prefixos (sem acento, minúsculo). */
export function coluna(
  cols: readonly { nome: string; col: number }[],
  ...prefixos: string[]
): number | null {
  for (const p of prefixos) {
    const achou = cols.find((x) => x.nome.startsWith(normal(p)));
    if (achou) return achou.col;
  }
  return null;
}
