import { describe, expect, it } from "vitest";
import { data, mesAno, mesDoIndice, moeda, numero, parseNumero, percentual } from "./index";

describe("numero", () => {
  it("usa ponto no milhar e vírgula no decimal", () => {
    expect(numero(1234.56, 2)).toBe("1.234,56");
    expect(numero(1234567.891, 2)).toBe("1.234.567,89");
    expect(numero(1234)).toBe("1.234");
    expect(numero(0.5, 2)).toBe("0,50");
  });
  it("arredonda meio para cima (contábil)", () => {
    expect(numero(1.005, 2)).toBe("1,01");
    expect(numero(2.675, 2)).toBe("2,68");
    expect(numero(-1.005, 2)).toBe("-1,01");
  });
  it("não mostra -0", () => {
    expect(numero(-0.001, 2)).toBe("0,00");
    expect(numero(-0)).toBe("0");
  });
  it("negativos com hífen", () => {
    expect(numero(-1234.5, 2)).toBe("-1.234,50");
  });
  it("valor ausente ou inválido vira travessão", () => {
    expect(numero(null)).toBe("—");
    expect(numero(undefined)).toBe("—");
    expect(numero(Number.NaN)).toBe("—");
    expect(numero(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("moeda", () => {
  it("R$ com espaço comum e 2 casas", () => {
    expect(moeda(1234.56)).toBe("R$ 1.234,56");
    expect(moeda(0)).toBe("R$ 0,00");
    expect(moeda(10171)).toBe("R$ 10.171,00");
  });
  it("sinal antes do símbolo", () => {
    expect(moeda(-38.5)).toBe("-R$ 38,50");
  });
  it("aceita casas decimais (0 para resumo)", () => {
    expect(moeda(10171.4, 0)).toBe("R$ 10.171");
  });
  it("ausente vira travessão", () => {
    expect(moeda(null)).toBe("—");
  });
});

describe("percentual", () => {
  it("recebe 0 a 100, como na interface", () => {
    expect(percentual(43.96)).toBe("43,96%");
    expect(percentual(22.64)).toBe("22,64%");
    expect(percentual(6.65)).toBe("6,65%");
    expect(percentual(25, 0)).toBe("25%");
    expect(percentual(3.8, 1)).toBe("3,8%");
  });
});

describe("data", () => {
  it("dd/mm/aaaa a partir de ISO sem fuso", () => {
    expect(data("2024-03-16")).toBe("16/03/2024");
    expect(data("2024-01-01T00:00:00Z")).toBe("01/01/2024");
  });
  it("aceita Date (componentes locais)", () => {
    expect(data(new Date(2027, 0, 5))).toBe("05/01/2027");
  });
  it("inválida vira travessão", () => {
    expect(data("2024-13-40")).toBe("—");
    expect(data("")).toBe("—");
    expect(data(null)).toBe("—");
  });
});

describe("mesAno", () => {
  it("mês abreviado e ano com 2 dígitos", () => {
    expect(mesAno(2027, 1)).toBe("jan/27");
    expect(mesAno(2024, 6)).toBe("jun/24");
    expect(mesAno(2030, 12)).toBe("dez/30");
  });
  it("rejeita mês fora de 1 a 12", () => {
    expect(() => mesAno(2027, 0)).toThrow();
    expect(() => mesAno(2027, 13)).toThrow();
  });
});

describe("mesDoIndice", () => {
  it("converte mes_idx relativo ao início da obra", () => {
    const inicio = { ano: 2024, mes: 3 };
    expect(mesDoIndice(inicio, 0)).toBe("mar/24");
    expect(mesDoIndice(inicio, 9)).toBe("dez/24");
    expect(mesDoIndice(inicio, 10)).toBe("jan/25");
    expect(mesDoIndice({ ano: 2026, mes: 11 }, 26)).toBe("jan/29");
  });
});

describe("parseNumero", () => {
  it("lê o formato brasileiro digitado", () => {
    expect(parseNumero("1.234,56")).toBe(1234.56);
    expect(parseNumero("R$ 1.234,56")).toBe(1234.56);
    expect(parseNumero("43,96%")).toBe(43.96);
    expect(parseNumero("-38,5")).toBe(-38.5);
    expect(parseNumero(" 12 ")).toBe(12);
    expect(parseNumero("1.500")).toBe(1500);
  });
  it("devolve null quando não é número", () => {
    expect(parseNumero("")).toBeNull();
    expect(parseNumero("abc")).toBeNull();
    expect(parseNumero("1,2,3")).toBeNull();
  });
});

describe("roda-trip", () => {
  it("parseNumero(numero(x)) devolve x", () => {
    for (const x of [0, 1, 999.99, 1234.56, -98765.43, 1_000_000]) {
      expect(parseNumero(numero(x, 2))).toBe(x);
    }
  });
});
