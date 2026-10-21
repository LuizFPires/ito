/**
 * Formatação no padrão brasileiro (CLAUDE.md, regra 3): R$ 1.234,56 · 43,96% · dd/mm/aaaa · jan/27.
 * Use estes utilitários em tela, exportação e área de transferência; nunca `toFixed` em texto exibido.
 */

export const VAZIO = "—";

export const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

type Valor = number | null | undefined;

const formatadores = new Map<number, Intl.NumberFormat>();

function formatador(casas: number): Intl.NumberFormat {
  let f = formatadores.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
      useGrouping: "always",
    });
    formatadores.set(casas, f);
  }
  return f;
}

/** Arredonda meio para cima no valor decimal escrito (1,005 → 1,01), sem o erro do binário. */
export function arredondar(v: number, casas = 2): number {
  const abs = Math.abs(v);
  const r = Number(Math.round(Number(`${abs}e${casas}`)) + `e-${casas}`);
  return r === 0 ? 0 : Math.sign(v) * r;
}

function valido(v: Valor): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 1234.56 → "1.234,56". Negativo com hífen; ausente ou inválido → "—". */
export function numero(v: Valor, casas = 0): string {
  if (!valido(v)) return VAZIO;
  const r = arredondar(v, casas);
  const txt = formatador(casas).format(Math.abs(r));
  return r < 0 ? `-${txt}` : txt;
}

/** 1234.56 → "R$ 1.234,56"; -38.5 → "-R$ 38,50". */
export function moeda(v: Valor, casas = 2): string {
  if (!valido(v)) return VAZIO;
  const r = arredondar(v, casas);
  const txt = `R$ ${formatador(casas).format(Math.abs(r))}`;
  return r < 0 ? `-${txt}` : txt;
}

/** Percentual guardado de 0 a 100: 43.96 → "43,96%". */
export function percentual(v: Valor, casas = 2): string {
  if (!valido(v)) return VAZIO;
  return `${numero(v, casas)}%`;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function dois(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Data em dd/mm/aaaa. Strings ISO ("2024-03-16" ou com hora) são lidas sem fuso,
 * para a data não "voltar um dia". `Date` usa os componentes locais.
 */
export function data(v: string | Date | null | undefined): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return VAZIO;
    return `${dois(v.getDate())}/${dois(v.getMonth() + 1)}/${v.getFullYear()}`;
  }
  const m = typeof v === "string" ? ISO.exec(v) : null;
  if (!m) return VAZIO;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return VAZIO;
  }
  return `${dois(dia)}/${dois(mes)}/${ano}`;
}

/** Mês abreviado: mesAno(2027, 1) → "jan/27". `mes` de 1 a 12. */
export function mesAno(ano: number, mes: number): string {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`Mês inválido: ${mes}. Use 1 a 12.`);
  }
  return `${MESES[mes - 1]}/${dois(((ano % 100) + 100) % 100)}`;
}

export interface InicioObra {
  ano: number;
  /** 1 a 12 */
  mes: number;
}

/** Converte o `mes_idx` (0..n−1, relativo ao início da obra) no rótulo "jan/27". */
export function mesDoIndice(inicio: InicioObra, mesIdx: number): string {
  const t = inicio.mes - 1 + mesIdx;
  const ano = inicio.ano + Math.floor(t / 12);
  return mesAno(ano, (((t % 12) + 12) % 12) + 1);
}

const NUMERO_BR = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/;

/** Lê número digitado no formato brasileiro ("R$ 1.234,56", "43,96%"). Inválido → null. */
export function parseNumero(txt: string): number | null {
  const limpo = txt.replace(/R\$/g, "").replace(/%/g, "").replace(/[\s ]/g, "").replace(/^−/, "-");
  if (!NUMERO_BR.test(limpo)) return null;
  return Number(limpo.replace(/\./g, "").replace(",", "."));
}
