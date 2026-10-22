import { describe, expect, it } from "vitest";
import { dataBaseNosProximos3Meses, diferencaOficial, valorOuEmpresa } from "./ccts";

describe("diferencaOficial", () => {
  it("max ÷ min − 1, ignorando faltantes", () => {
    expect(diferencaOficial([1400, 1300, undefined, 1500])).toBeCloseTo(1500 / 1300 - 1, 12);
  });
  it("menos de duas CCTs dá zero", () => {
    expect(diferencaOficial([1400])).toBe(0);
  });
});

describe("dataBaseNosProximos3Meses", () => {
  it("conta o mês atual e os dois seguintes", () => {
    expect(dataBaseNosProximos3Meses([5, 6, 7, 8], 5)).toBe(3);
  });
  it("atravessa a virada do ano", () => {
    expect(dataBaseNosProximos3Meses([11, 12, 1, 2], 11)).toBe(3);
    expect(dataBaseNosProximos3Meses([1, 2, 3], 12)).toBe(2);
  });
});

describe("valorOuEmpresa", () => {
  it("usa o valor da CCT quando existe", () => {
    expect(valorOuEmpresa({ ped: 1500 }, { ped: 1400 }, "ped")).toEqual({
      valor: 1500,
      daEmpresa: false,
    });
  });
  it("cai na tabela da empresa", () => {
    expect(valorOuEmpresa({}, { ped: 1400 }, "ped")).toEqual({ valor: 1400, daEmpresa: true });
  });
});
