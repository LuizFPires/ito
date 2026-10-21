import { describe, expect, it } from "vitest";
import { alternarOrdem, codigoDe, contemTermos, ordenar, paginar } from "./lista";

describe("contemTermos", () => {
  it("sem acento, sem caixa, todos os termos", () => {
    expect(contemTermos("Técnico de segurança · 04.03.13", "tecnico SEGURANCA")).toBe(true);
    expect(contemTermos("Pedreiro", "pedreiro carp")).toBe(false);
    expect(contemTermos("qualquer", "  ")).toBe(true);
  });
});

describe("ordenar", () => {
  const itens = [
    { n: "Servente", v: 3 },
    { n: "Armador", v: 10 },
    { n: "Ética", v: 2 },
  ];
  it("texto em pt-BR, ignorando acento", () => {
    expect(ordenar(itens, { chave: "n", dir: 1 }, (x) => x.n).map((x) => x.n)).toEqual([
      "Armador",
      "Ética",
      "Servente",
    ]);
  });
  it("número e direção", () => {
    expect(ordenar(itens, { chave: "v", dir: -1 }, (x) => x.v).map((x) => x.v)).toEqual([10, 3, 2]);
  });
  it("não altera a lista original", () => {
    const copia = [...itens];
    ordenar(itens, { chave: "n", dir: -1 }, (x) => x.n);
    expect(itens).toEqual(copia);
  });
});

describe("paginar", () => {
  const nums = Array.from({ length: 23 }, (_, i) => i + 1);
  it("fatia e informa o intervalo", () => {
    const p = paginar(nums, 3, 10);
    expect(p.itens).toEqual([21, 22, 23]);
    expect(p).toMatchObject({ pagina: 3, paginas: 3, total: 23, de: 21, ate: 23 });
  });
  it("página fora do intervalo é ajustada", () => {
    expect(paginar(nums, 99, 10).pagina).toBe(3);
    expect(paginar(nums, 0, 10).pagina).toBe(1);
  });
  it("lista vazia", () => {
    expect(paginar([], 1, 10)).toMatchObject({ itens: [], paginas: 1, de: 0, ate: 0 });
  });
});

describe("alternarOrdem", () => {
  it("mesma chave inverte; outra chave começa crescente", () => {
    expect(alternarOrdem({ chave: "a", dir: 1 }, "a")).toEqual({ chave: "a", dir: -1 });
    expect(alternarOrdem<"a" | "b">({ chave: "a", dir: -1 }, "b")).toEqual({ chave: "b", dir: 1 });
  });
});

describe("codigoDe", () => {
  it("gera código válido para o banco", () => {
    expect(codigoDe("Operador de betoneira")).toBe("operador_de_betoneira");
    expect(codigoDe("Técnico Elétrico (N2)")).toBe("tecnico_eletrico_n2");
    expect(codigoDe("3º encarregado")).toBe("f_3_encarregado");
    expect(codigoDe("a".repeat(50))).toHaveLength(32);
  });
});
