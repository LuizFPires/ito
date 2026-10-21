import { describe, expect, it } from "vitest";
import { adicionaisPorPessoa } from "./adicionais";

// Tabela da empresa 2026 (carga inicial = protótipo ITO 2.0)
const db2026 = { salario_minimo: 1621, divisor: 220, adicional_noturno_pct: 20 };
const base = { vinculo: "clt", peric_pct: 0, insal_pct_sm: 0, horas_noturnas_mes: 0 };

describe("adicionaisPorPessoa — valores do protótipo (Quem recebe o quê, 2026)", () => {
  it("Eletricista: periculosidade 30% de 1.880 = 564,00", () => {
    expect(adicionaisPorPessoa({ ...base, peric_pct: 30 }, 1880, db2026)).toBeCloseTo(564, 10);
  });
  it("Operador de guincho: insalubridade 20% do SM 1.621 = 324,20", () => {
    expect(adicionaisPorPessoa({ ...base, insal_pct_sm: 20 }, 1560, db2026)).toBeCloseTo(324.2, 10);
  });
  it("Vigia: 80 h noturnas × 1.430 / 220 × 20% = 104,00", () => {
    expect(adicionaisPorPessoa({ ...base, horas_noturnas_mes: 80 }, 1430, db2026)).toBeCloseTo(
      104,
      10,
    );
  });
  it("estágio não recebe adicionais", () => {
    expect(adicionaisPorPessoa({ ...base, vinculo: "estagio", peric_pct: 30 }, 1300, db2026)).toBe(
      0,
    );
  });
});
