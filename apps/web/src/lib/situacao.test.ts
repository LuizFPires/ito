import { describe, expect, it } from "vitest";
import { textoAndamento, textoPeriodo } from "./situacao";

describe("situação da obra", () => {
  it("período fechado ou só o início", () => {
    expect(textoPeriodo({ inicio: "2025-03-01", meses: 20 })).toBe("mar/25 – out/26");
    expect(textoPeriodo({ inicio: "2026-01-01", meses: 0 })).toBe("a partir de jan/26");
  });
  it("andamento com e sem prazo previsto", () => {
    expect(textoAndamento({ meses: 0, prazo_previsto: 12 })).toBe("nenhum mês lançado");
    expect(textoAndamento({ meses: 3, prazo_previsto: 14 })).toBe("3 de 14 meses previstos");
    expect(textoAndamento({ meses: 1, prazo_previsto: null })).toBe("1 mês lançado");
    expect(textoAndamento({ meses: 4, prazo_previsto: null })).toBe("4 meses lançados");
  });
});
