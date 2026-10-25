import { describe, expect, it } from "vitest";
import { decodificarTexto, ErroArquivo, lerArquivos } from "./leitura";
import type { LerXlsx } from "./leitura";

const xlsx = { name: "f.xlsx", bytes: new ArrayBuffer(8) };
const abas =
  (n: number, linhas = 1): LerXlsx =>
  async () =>
    Array.from({ length: n }, (_, i) => ({ sheet: `Aba ${i + 1}`, data: Array(linhas).fill([]) }));
const texto = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("leitura da carga no worker (M14 · S07)", () => {
  it("planilha com abas ou linhas demais é recusada com o que fazer", async () => {
    await expect(lerArquivos("folha", [xlsx], abas(31))).rejects.toThrow(
      "Planilha com mais de 30 abas: use o modelo do ITO.",
    );
    await expect(lerArquivos("ponto", [xlsx], abas(1, 300_001))).rejects.toBeInstanceOf(
      ErroArquivo,
    );
  });

  it("notas: cada XML lido, com DTD recusado e resumo em R$", async () => {
    const r = await lerArquivos(
      "nf",
      [{ name: "a.xml", bytes: texto('<!DOCTYPE x [<!ENTITY y "z">]><a>&y;</a>') }],
      abas(0),
    );
    expect(r.erros[0]!.mensagem).toContain("DTD");
    expect(r.resumo).toBe(
      "0 notas · R$ 0,00 em serviços · ISS R$ 0,00, PIS R$ 0,00 e COFINS R$ 0,00 retidos",
    );
  });

  it("CSV do Excel brasileiro (Windows-1252) é decodificado", () => {
    const bytes = new Uint8Array([0x46, 0x75, 0x6e, 0xe7, 0xe3, 0x6f]).buffer; // "Função"
    expect(decodificarTexto(bytes)).toBe("Função");
  });
});
