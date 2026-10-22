import { describe, expect, it } from "vitest";
import { escreverCsv, lerCsv, numeroBr } from "./csv";

describe("CSV das tabelas da migração", () => {
  it("ida e volta com ;, aspas e quebra de linha", () => {
    const t = escreverCsv(
      ["id", "nome", "obs"],
      [{ id: "mm_uba", nome: 'MART MINAS "UBÁ"', obs: "a; b\nc" }],
    );
    expect(t.startsWith("﻿id;nome;obs\r\n")).toBe(true);
    expect(lerCsv(t)).toEqual([{ id: "mm_uba", nome: 'MART MINAS "UBÁ"', obs: "a; b\nc" }]);
  });

  it("aceita vírgula como separador (Excel em outro idioma) e ignora linhas vazias", () => {
    expect(lerCsv("id,area\r\nx,4800\r\n\r\n")).toEqual([{ id: "x", area: "4800" }]);
  });

  it("números no formato BR", () => {
    expect(numeroBr("4.800")).toBe(4800);
    expect(numeroBr("4.800,5")).toBe(4800.5);
    expect(numeroBr("4800.5")).toBe(4800.5);
    expect(numeroBr("")).toBeNull();
    expect(numeroBr("abc")).toBeNull();
  });
});
