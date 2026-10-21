import { describe, expect, it } from "vitest";
import { feriadosDaCidade, vtDiario, vtDiarioDe } from "./local";

const bh = { id: "bh", tarifaLocal: 6.25, conducoes: 1, passagens: {} };
const vespasiano = { id: "vespasiano", tarifaLocal: 5.5, conducoes: 1, passagens: { bh: 12.4 } };
const contagem = { id: "contagem", tarifaLocal: 5.8, conducoes: 2, passagens: {} };

describe("vtDiario (MO local) — SPEC §3: tarifa × conduções × 2", () => {
  it("golden SPEC §8: Vespasiano local = R$ 11,00", () => {
    expect(vtDiario(vespasiano)).toBeCloseTo(11, 10);
  });
  it("conta as conduções", () => {
    expect(vtDiario(contagem)).toBeCloseTo(23.2, 10);
  });
});

describe("vtDiarioDe (MO que vem de outra cidade todo dia) — SPEC §4.4", () => {
  it("golden SPEC §8: Vespasiano vindo de BH = R$ 24,80 (passagem cadastrada × 2)", () => {
    expect(vtDiarioDe(vespasiano, bh)).toEqual({ valor: 24.8, estimado: false });
  });
  it("sem passagem cadastrada: (tarifa da obra + tarifa da origem) × 2, marcado estimado", () => {
    const r = vtDiarioDe(contagem, bh);
    expect(r.estimado).toBe(true);
    expect(r.valor).toBeCloseTo((5.8 + 6.25) * 2, 10);
  });
  it("origem = a própria cidade é VT local", () => {
    expect(vtDiarioDe(contagem, contagem)).toEqual({ valor: vtDiario(contagem), estimado: false });
  });
  it("passagem zero conta como não cadastrada", () => {
    const r = vtDiarioDe({ ...vespasiano, passagens: { bh: 0 } }, bh);
    expect(r.estimado).toBe(true);
  });
});

describe("feriadosDaCidade — dia/mês recorrente vira data do ano", () => {
  const fer = [
    { dia: 15, mes: 8, nome: "Assunção de Nossa Senhora" },
    { dia: 29, mes: 2, nome: "Só em ano bissexto" },
  ];
  it("gera a data ISO de cada ano", () => {
    expect(feriadosDaCidade(fer, 2026)).toEqual([
      { data: "2026-08-15", nome: "Assunção de Nossa Senhora" },
    ]);
  });
  it("29/02 só existe em ano bissexto", () => {
    expect(feriadosDaCidade(fer, 2028).map((f) => f.data)).toEqual(["2028-02-29", "2028-08-15"]);
  });
});
