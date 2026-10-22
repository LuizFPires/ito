import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { lerXlsb, numeroRk, registros } from "./xlsb";

/** Monta um registro BIFF12 (tipo e tamanho em varint de 7 bits). */
function reg(tipo: number, dados: number[] = []): number[] {
  const t = tipo < 0x80 ? [tipo] : [(tipo & 0x7f) | 0x80, tipo >> 7];
  const tam: number[] = [];
  let n = dados.length;
  do {
    const b = n & 0x7f;
    n >>= 7;
    tam.push(n ? b | 0x80 : b);
  } while (n);
  return [...t, ...tam, ...dados];
}
const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
const f64 = (v: number) => [...new Uint8Array(new Float64Array([v]).buffer)];
const largo = (s: string) => [
  ...u32(s.length),
  ...[...s].flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8]),
];
const celula = (tipo: number, col: number, valor: number[]) =>
  reg(tipo, [...u32(col), ...u32(0), ...valor]);

function xlsbSintetico(): Uint8Array {
  const workbook = reg(156, [...u32(0), ...u32(1), ...largo("rId1"), ...largo("Histograma")]);
  const rels =
    '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.bin" Type="x"/></Relationships>';
  const sst = [...reg(19, [0, ...largo("Pedreiro")]), ...reg(19, [0, ...largo("Matrícula")])];
  const planilha = [
    ...reg(0, u32(0)), // linha 0
    ...celula(7, 0, u32(1)), // texto compartilhado 1
    ...celula(5, 1, f64(1234.56)), // real
    ...reg(0, u32(4)), // linha 4
    ...celula(2, 0, u32((99060 << 2) | 2)), // RK inteiro
    ...celula(2, 1, u32((150 << 2) | 3)), // RK inteiro ÷ 100
    ...celula(7, 2, u32(0)),
    ...celula(6, 3, largo("Ativo")), // texto inline
    ...celula(9, 4, [...f64(45108), 0, 0]), // fórmula numérica (valor calculado)
    ...celula(3, 5, [0x2a]), // erro (#N/D) = vazio
    ...celula(4, 6, [1]), // booleano
  ];
  return zipSync({
    "xl/workbook.bin": new Uint8Array(workbook),
    "xl/_rels/workbook.bin.rels": strToU8(rels),
    "xl/sharedStrings.bin": new Uint8Array(sst),
    "xl/worksheets/sheet1.bin": new Uint8Array(planilha),
  });
}

describe("leitor .xlsb", () => {
  it("abas, linhas esparsas e os tipos de célula", () => {
    const p = lerXlsb(xlsbSintetico());
    expect(Object.keys(p)).toEqual(["Histograma"]);
    const l = p.Histograma!;
    expect(l[0]).toEqual(["Matrícula", 1234.56]);
    expect(l[1]).toBeUndefined();
    expect(l[4]).toEqual([99060, 1.5, "Pedreiro", "Ativo", 45108, null, true]);
  });

  it("filtra abas e limita linhas", () => {
    expect(lerXlsb(xlsbSintetico(), { abas: ["Outra"] })).toEqual({});
    expect(lerXlsb(xlsbSintetico(), { maxLinhas: 1 }).Histograma!.length).toBe(1);
  });

  it("número RK em double (30 bits altos) e tipo de registro em 2 bytes", () => {
    // 1,0 em double = 0x3FF00000 00000000
    expect(numeroRk(0x3ff00000)).toBe(1);
    const [r] = [...registros(new Uint8Array(reg(156, [1, 2])))];
    expect(r!.tipo).toBe(156);
    expect(r!.dados.byteLength).toBe(2);
  });
});
