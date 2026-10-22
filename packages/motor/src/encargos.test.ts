import { describe, expect, it } from "vitest";
import { ENCARGOS_REFERENCIA, taxasEncargos } from "./encargos";

describe("taxasEncargos — golden SPEC §8 (CCT 2026, AF v07)", () => {
  const t = taxasEncargos(ENCARGOS_REFERENCIA);

  it("encargos sociais CLT = 43,96% (inclui incidência de 7,16%)", () => {
    expect(t.soc.clt * 100).toBeCloseTo(43.96, 2);
    expect(t.incidencia.clt * 100).toBeCloseTo(7.16, 2);
  });

  it("provisões CLT = 22,64%", () => {
    expect(t.prov.clt * 100).toBeCloseTo(22.64, 2);
  });

  it("total S/P = 6,65% (tributos sobre NF, sem encargos de folha)", () => {
    expect(t.nf.sp * 100).toBeCloseTo(6.65, 2);
    expect(t.soc.sp).toBe(0);
    expect(t.prov.sp).toBe(0);
  });

  it("CLT não paga tributo de NF", () => {
    expect(t.nf.clt).toBe(0);
  });

  it("valores exatos usados pelo motor", () => {
    // soc base 36,8% + 36,8% × (8,3333 + 2,7778 + 8,3333)%
    expect(t.soc.clt).toBeCloseTo(0.368 + 0.368 * 0.194444, 6);
    // férias + 1/3 + 13º + GRRF (8% × 40%)
    expect(t.prov.clt).toBeCloseTo(0.194444 + 0.032, 6);
  });
});

describe("taxasEncargos — regras", () => {
  it("base de cálculo reduz a alíquota (GRRF = 40% sobre base de 8%)", () => {
    const t = taxasEncargos([
      { id: "grrf", grupo: "prov", nome: "GRRF", baseCalcPct: 8, aliqClt: 40, aliqSp: 0 },
    ]);
    expect(t.prov.clt).toBeCloseTo(0.032, 12);
  });

  it("incidência só sobre férias, 1/3 e 13º (não sobre GRRF)", () => {
    const t = taxasEncargos([
      { id: "inss", grupo: "soc", nome: "INSS", baseCalcPct: 100, aliqClt: 20, aliqSp: 0 },
      { id: "grrf", grupo: "prov", nome: "GRRF", baseCalcPct: 8, aliqClt: 40, aliqSp: 0 },
    ]);
    expect(t.incidencia.clt).toBe(0);
    expect(t.soc.clt).toBeCloseTo(0.2, 12);
  });

  it("lista vazia dá zero", () => {
    const t = taxasEncargos([]);
    expect(t.soc.clt + t.prov.clt + t.nf.sp).toBe(0);
  });
});
