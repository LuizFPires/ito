import { describe, expect, it } from "vitest";
import { diasDoMes } from "./calendarioObra";
import type { Tabela } from "./modelo";

const ctx = { calendario: { carnaval: false, corpusChristi: true, feriadosEmpresa: [] } };
const t = (over: Partial<Tabela>) =>
  ({
    modoDias: "calendario",
    sabadoTrabalhado: false,
    diasFixos: 22,
    dsrFixoPct: 20,
    ...over,
  }) as Tabela;

describe("diasDoMes", () => {
  const obra = { inicio: { ano: 2017, mes: 3 } }; // mar/17

  it("modo calendário: mês 2 da obra = mai/2017 → 26 úteis, 5 repousos, 22 seg–sex", () => {
    const d = diasDoMes(obra, 2, t({}), ctx);
    expect(d.dsrPct).toBeCloseTo((5 / 26) * 100, 10);
    expect(d.diasTrabalhados).toBe(22);
  });

  it("sábado trabalhado soma os sábados úteis", () => {
    expect(diasDoMes(obra, 2, t({ sabadoTrabalhado: true }), ctx).diasTrabalhados).toBe(26);
  });

  it("feriado municipal da obra entra no calendário", () => {
    const comMunicipal = {
      ...obra,
      feriadosMunicipais: [{ data: "2017-05-15", nome: "Padroeira" }],
    };
    const d = diasDoMes(comMunicipal, 2, t({}), ctx);
    expect(d.diasTrabalhados).toBe(21);
    expect(d.dsrPct).toBeCloseTo((6 / 25) * 100, 10);
  });

  it("modo fixo usa dias e DSR da tabela", () => {
    expect(diasDoMes(obra, 2, t({ modoDias: "fixo" }), ctx)).toEqual({
      dsrPct: 20,
      diasTrabalhados: 22,
    });
  });
});
