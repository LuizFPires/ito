/**
 * Leitor mínimo de .xlsb (Excel binário, BIFF12) para a migração do histórico (M9): nomes das
 * abas, textos compartilhados e valores das células (sem estilos nem fórmulas, só o valor
 * calculado). Sem dependência nova: o .xlsb é um zip (fflate) com registros binários.
 *
 * Referência: [MS-XLSB] — registro = tipo (varint 7 bits) + tamanho (varint 7 bits) + dados.
 */
import { strFromU8, unzipSync } from "fflate";

export type ValorCelula = string | number | boolean | null;
/** aba → linhas (índice da linha a partir de 0) → células (índice da coluna a partir de 0) */
export type PlanilhaBruta = Record<string, ValorCelula[][]>;

const BRT = {
  ROW_HDR: 0,
  CELL_BLANK: 1,
  CELL_RK: 2,
  CELL_ERROR: 3,
  CELL_BOOL: 4,
  CELL_REAL: 5,
  CELL_ST: 6,
  CELL_ISST: 7,
  FMLA_STRING: 8,
  FMLA_NUM: 9,
  FMLA_BOOL: 10,
  FMLA_ERROR: 11,
  SST_ITEM: 19,
  BUNDLE_SH: 156,
} as const;

interface Registro {
  tipo: number;
  dados: DataView;
}

/** Percorre os registros de um fluxo BIFF12. */
export function* registros(buf: Uint8Array): Generator<Registro> {
  let p = 0;
  while (p < buf.length) {
    // tipo: 1 ou 2 bytes, 7 bits cada, bit alto = continua
    let tipo = buf[p]! & 0x7f;
    if (buf[p++]! & 0x80) tipo |= (buf[p++]! & 0x7f) << 7;
    // tamanho: até 4 bytes, 7 bits cada
    let tam = 0;
    for (let i = 0; i < 4; i++) {
      const b = buf[p++]!;
      tam |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) break;
    }
    if (p + tam > buf.length) return;
    yield { tipo, dados: new DataView(buf.buffer, buf.byteOffset + p, tam) };
    p += tam;
  }
}

/** XLWideString: tamanho (4 bytes, em caracteres) + UTF-16LE. Devolve o texto e o fim. */
function textoLargo(d: DataView, ini: number): [string, number] {
  const n = d.getUint32(ini, true);
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint16(ini + 4 + 2 * i, true));
  return [s, ini + 4 + 2 * n];
}

/** RkNumber: 30 bits de valor; bit 0 = ÷100; bit 1 = inteiro (senão, alto de um double). */
export function numeroRk(rk: number): number {
  const cem = rk & 1;
  let v: number;
  if (rk & 2) v = rk >> 2;
  else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(4, rk & 0xfffffffc, true);
    v = b.getFloat64(0, true);
  }
  return cem ? v / 100 : v;
}

/** Valor de um registro de célula (a coluna está nos 4 primeiros bytes; estilo nos 4 seguintes). */
function valorCelula(r: Registro, sst: readonly string[]): ValorCelula | undefined {
  const d = r.dados;
  switch (r.tipo) {
    case BRT.CELL_BLANK:
      return null;
    case BRT.CELL_RK:
      return numeroRk(d.getUint32(8, true));
    case BRT.CELL_REAL:
    case BRT.FMLA_NUM:
      return d.getFloat64(8, true);
    case BRT.CELL_BOOL:
    case BRT.FMLA_BOOL:
      return d.getUint8(8) !== 0;
    case BRT.CELL_ERROR:
    case BRT.FMLA_ERROR:
      return null;
    case BRT.CELL_ISST:
      return sst[d.getUint32(8, true)] ?? null;
    case BRT.CELL_ST:
    case BRT.FMLA_STRING:
      return textoLargo(d, 8)[0];
    default:
      return undefined;
  }
}

function lerSst(buf: Uint8Array | undefined): string[] {
  const sst: string[] = [];
  if (!buf) return sst;
  for (const r of registros(buf))
    if (r.tipo === BRT.SST_ITEM) {
      // RichStr: 1 byte de flags, depois o texto (formatação ignorada)
      sst.push(textoLargo(r.dados, 1)[0]);
    }
  return sst;
}

/** Abas na ordem do arquivo, com o caminho de cada uma (pelas relações do workbook). */
function abas(z: Record<string, Uint8Array>): { nome: string; caminho: string }[] {
  const rels = strFromU8(z["xl/_rels/workbook.bin.rels"] ?? new Uint8Array());
  const alvo = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) alvo.set(id, t.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const lista: { nome: string; caminho: string }[] = [];
  for (const r of registros(z["xl/workbook.bin"] ?? new Uint8Array())) {
    if (r.tipo !== BRT.BUNDLE_SH) continue;
    // hsState (4) + iTabID (4) + strRelID + strName
    const [rid, fim] = textoLargo(r.dados, 8);
    const [nome] = textoLargo(r.dados, fim);
    const t = alvo.get(rid);
    if (t) lista.push({ nome, caminho: `xl/${t}` });
  }
  return lista;
}

/**
 * Lê as abas pedidas (ou todas) de um .xlsb. `maxLinhas` limita abas enormes (há planilhas com
 * a dimensão até a linha 1.048.575 sem dados).
 */
export function lerXlsb(
  bytes: Uint8Array,
  opcoes: { abas?: readonly string[]; maxLinhas?: number } = {},
): PlanilhaBruta {
  const z = unzipSync(bytes);
  const sst = lerSst(z["xl/sharedStrings.bin"]);
  const saida: PlanilhaBruta = {};
  const max = opcoes.maxLinhas ?? 20_000;
  for (const a of abas(z)) {
    if (opcoes.abas && !opcoes.abas.includes(a.nome)) continue;
    const buf = z[a.caminho];
    if (!buf) continue;
    const linhas: ValorCelula[][] = [];
    let linha = -1;
    let truncada = false;
    for (const r of registros(buf)) {
      if (r.tipo === BRT.ROW_HDR) {
        linha = r.dados.getUint32(0, true);
        continue;
      }
      if (linha < 0) continue;
      const v = valorCelula(r, sst);
      if (v === undefined) continue;
      if (linha >= max) {
        // célula vazia além do limite não conta (dimensão inflada); com dado, avisa
        if (v !== null && v !== "") truncada = true;
        continue;
      }
      const col = r.dados.getUint32(0, true);
      (linhas[linha] ??= [])[col] = v;
    }
    if (truncada)
      console.warn(`aba ${a.nome}: há dados depois da linha ${max}, que ficaram de fora`);
    saida[a.nome] = linhas;
  }
  return saida;
}
