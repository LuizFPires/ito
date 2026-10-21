/**
 * Planilha genérica (abas → linhas de células), lida no navegador a partir de .xlsx ou .csv.
 * Os leitores só pegam as colunas que conhecem: qualquer outra (nome, CPF…) é ignorada e nunca
 * chega ao resultado (CLAUDE.md, regra 2).
 */
import { parseNumero } from "@ito/formato";

export type Celula = string | number | boolean | Date | null | undefined;
export type Linhas = readonly (readonly Celula[])[];
/** Abas pelo nome; um .csv vira uma aba só. */
export type Planilha = Readonly<Record<string, Linhas>>;

export interface Competencia {
  ano: number;
  /** 1 a 12 */
  mes: number;
}

/** "Competência", "competencia " e "COMPETÊNCIA" são o mesmo cabeçalho. */
export function normalizar(txt: unknown): string {
  return String(txt ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9%()]+/g, " ")
    .trim();
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ok = (ano: number, mes: number): Competencia | null =>
  Number.isInteger(ano) &&
  Number.isInteger(mes) &&
  mes >= 1 &&
  mes <= 12 &&
  ano >= 1990 &&
  ano <= 2100
    ? { ano, mes }
    : null;
const ano4 = (a: number) => (a < 100 ? 2000 + a : a);

/** Competência: data, "03/2025", "2025-03", "mar/25", "01/03/2025" ou 202503. */
export function lerCompetencia(c: Celula): Competencia | null {
  if (c instanceof Date) return ok(c.getUTCFullYear(), c.getUTCMonth() + 1);
  if (typeof c === "number") return ok(Math.floor(c / 100), c % 100);
  const t = normalizar(c).replace(/ /g, "/");
  let m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return ok(Number(m[2]), Number(m[1]));
  m = /^(\d{4})\/(\d{1,2})(\/\d{1,2})?$/.exec(t);
  if (m) return ok(Number(m[1]), Number(m[2]));
  m = /^\d{1,2}\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return ok(Number(m[2]), Number(m[1]));
  m = /^([a-z]{3})[a-z]*\/(\d{2}|\d{4})$/.exec(t);
  if (m && MESES.includes(m[1]!)) return ok(ano4(Number(m[2])), MESES.indexOf(m[1]!) + 1);
  m = /^(\d{4})(\d{2})$/.exec(t);
  if (m) return ok(Number(m[1]), Number(m[2]));
  return null;
}

/** Número da planilha: célula numérica ou texto no formato brasileiro ("1.234,56"). */
export function lerNumero(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (c === null || c === undefined || c === "" || typeof c === "boolean" || c instanceof Date)
    return null;
  const t = String(c).trim();
  if (t === "") return null;
  const br = parseNumero(t);
  if (br !== null) return br;
  // exportação com ponto decimal ("1234.56")
  return /^-?\d+\.\d+$/.test(t) ? Number(t) : null;
}

/** Sim/não: "S", "sim", "x", "1", true. Vazio = não. */
export function lerSimNao(c: Celula): boolean {
  if (typeof c === "boolean") return c;
  if (typeof c === "number") return c !== 0;
  return ["s", "sim", "x", "1", "true", "verdadeiro"].includes(normalizar(c));
}

export function lerTexto(c: Celula): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "number") return String(c);
  return String(c).trim();
}

/** Matrícula: texto curto, sem espaços ("1001", "00123", "A-12"). Número do Excel vira texto. */
export function lerMatricula(c: Celula): string | null {
  const t = typeof c === "number" && Number.isInteger(c) ? String(c) : lerTexto(c);
  return /^[0-9A-Za-z./-]{1,20}$/.test(t) ? t : null;
}

// ── colunas ─────────────────────────────────────────────────────────────────

export interface Coluna<K extends string> {
  chave: K;
  /** cabeçalho no modelo do ITO */
  titulo: string;
  /** outros cabeçalhos aceitos (exportações comuns) */
  aceita?: readonly string[];
  obrigatoria?: boolean;
  /** explicação no modelo */
  ajuda: string;
  exemplo: string | number;
}

export interface Aba<K extends string> {
  nome: string;
  /** nomes alternativos da aba */
  aceita?: readonly string[];
  colunas: readonly Coluna<K>[];
}

export interface ErroLeitura {
  aba: string;
  /** linha da planilha (1 = cabeçalho); 0 = a aba inteira */
  linha: number;
  mensagem: string;
}

/** Encontra a aba pelo nome; com `unica`, aceita a única aba do arquivo (um .csv). */
export function acharAba(p: Planilha, aba: Aba<string>, unica = false): Linhas | null {
  const nomes = [aba.nome, ...(aba.aceita ?? [])].map(normalizar);
  for (const [k, v] of Object.entries(p)) if (nomes.includes(normalizar(k))) return v;
  const abas = Object.values(p);
  return unica && abas.length === 1 ? abas[0]! : null;
}

/**
 * Lê as linhas de uma aba como registros {chave: célula}. O cabeçalho pode estar em qualquer
 * das 10 primeiras linhas (exportações costumam ter título em cima). Linhas vazias são puladas.
 */
export function lerAba<K extends string>(
  linhas: Linhas,
  aba: Aba<K>,
): { registros: { linha: number; c: Record<K, Celula> }[]; erros: ErroLeitura[] } {
  const nomesDe = (col: Coluna<K>) => [col.titulo, ...(col.aceita ?? [])].map(normalizar);
  const obrig = aba.colunas.filter((c) => c.obrigatoria);
  let iCab = -1;
  let pos: Partial<Record<K, number>> = {};
  for (let i = 0; i < Math.min(10, linhas.length) && iCab < 0; i++) {
    const cab = (linhas[i] ?? []).map(normalizar);
    const achadas: Partial<Record<K, number>> = {};
    for (const col of aba.colunas) {
      const j = cab.findIndex((h) => nomesDe(col).includes(h));
      if (j >= 0) achadas[col.chave] = j;
    }
    if (obrig.every((c) => achadas[c.chave] !== undefined)) {
      iCab = i;
      pos = achadas;
    }
  }
  if (iCab < 0) {
    const faltam = obrig.map((c) => c.titulo).join(", ");
    return {
      registros: [],
      erros: [
        {
          aba: aba.nome,
          linha: 0,
          mensagem: `A aba ${aba.nome} precisa das colunas ${faltam}. Use o modelo do ITO.`,
        },
      ],
    };
  }
  const registros: { linha: number; c: Record<K, Celula> }[] = [];
  for (let i = iCab + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    if (l.every((x) => x === null || x === undefined || String(x).trim() === "")) continue;
    const c = {} as Record<K, Celula>;
    for (const col of aba.colunas) {
      const j = pos[col.chave];
      c[col.chave] = j === undefined ? null : l[j];
    }
    registros.push({ linha: i + 1, c });
  }
  return { registros, erros: [] };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

/** CSV com ";" (padrão brasileiro) ou ","; aspas duplas escapam o separador. */
export function lerCsv(texto: string): string[][] {
  const t = texto.startsWith("\u{FEFF}") ? texto.slice(1) : texto; // BOM do Excel
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}
