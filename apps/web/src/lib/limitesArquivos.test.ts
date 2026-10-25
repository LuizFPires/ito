import { describe, expect, it } from "vitest";
import { foraDoLimite, LIMITES_ARQUIVO } from "./limitesArquivos";

describe("limites dos arquivos da carga (M13 · S07)", () => {
  it("planilha até 50 MB", () => {
    expect(foraDoLimite("folha", [{ name: "f.xlsx", size: 18_000_000 }])).toBeNull();
    expect(
      foraDoLimite("folha", [{ name: "f.xlsx", size: LIMITES_ARQUIVO.planilhaBytes + 1 }]),
    ).toBe("“f.xlsx” passa de 50 MB: divida o arquivo por período e carregue um de cada vez.");
  });

  it("notas: até 2.000 XMLs de até 2 MB", () => {
    const nota = { name: "n.xml", size: 10_000 };
    expect(foraDoLimite("nf", [nota, nota])).toBeNull();
    expect(
      foraDoLimite(
        "nf",
        Array.from({ length: 2001 }, () => nota),
      ),
    ).toBe("Envie até 2.000 notas por vez (vieram 2.001).");
    expect(foraDoLimite("nf", [nota, { name: "g.xml", size: 3 * 1024 * 1024 }])).toContain(
      "“g.xml” passa de 2 MB",
    );
  });
});
