import { describe, expect, it } from "vitest";
import {
  codigoDaObra,
  doCampoMes,
  faltasDaObra,
  fimDe,
  mesesEntre,
  paraCampoMes,
  rascunhoVazio,
} from "./estado";

describe("código da obra", () => {
  it("sem acento, minúsculo, com _", () => {
    expect(codigoDaObra("Mart Minas — Paracatu/MG")).toBe("mart_minas_paracatu_mg");
    expect(codigoDaObra("123 Galpão")).toBe("obra_123_galpao");
    expect(codigoDaObra("")).toBe("obra");
    expect(codigoDaObra("x".repeat(60))).toHaveLength(48);
  });
});

describe("período", () => {
  it("campo mês ↔ início; fim e meses", () => {
    expect(doCampoMes("2025-03")).toEqual({ ano: 2025, mes: 3 });
    expect(doCampoMes("2025-13")).toBeNull();
    expect(paraCampoMes({ ano: 2025, mes: 3 })).toBe("2025-03");
    expect(fimDe({ ano: 2025, mes: 11 }, 3)).toEqual({ ano: 2026, mes: 1 });
    expect(mesesEntre({ ano: 2025, mes: 11 }, { ano: 2026, mes: 1 })).toBe(3);
  });
});

describe("etapa Obra", () => {
  const vazio = rascunhoVazio(2025, new Date(2026, 9, 21));
  it("rascunho nasce na data-base vigente e sem período", () => {
    expect(vazio.dados).toMatchObject({ dataBase: 2025, meses: 0, inicio: { ano: 2026, mes: 10 } });
  });
  it("diz o que falta, com a ação", () => {
    expect(faltasDaObra(vazio.dados, [])).toEqual([
      "Informe o nome da obra.",
      "Código: comece com letra; use letras minúsculas, números e _.",
      "Informe a área construída (m²).",
      "Informe início e término (o término não pode ser antes do início).",
    ]);
    const ok = { ...vazio.dados, nome: "Obra X", id: "obra_x", area: 1000, meses: 5 };
    expect(faltasDaObra(ok, [])).toEqual([]);
    expect(faltasDaObra(ok, [{ id: "outra", nome: "obra x" }])[0]).toContain("Já existe");
  });
});
