import { describe, expect, it } from "vitest";
import type { ObraBanco } from "../../lib/obraDoBanco";
import { dataBaseNoMes, rascunhoDoMes } from "./mesDaObra";

const b = {
  obra: {
    id: "obra_y",
    nome: "Obra Y",
    cliente: "",
    tipologia: "Comercial",
    cidade_id: "bh",
    area_m2: 1000,
    inicio: "2025-11-01",
    meses: 3,
    data_base: 2025,
  },
  competencias: [],
  efetivo: [],
  regime: [{ funcao_id: "ped", regime: "sp" }],
  trocas: [{ mes_idx: 2, data_base: 2026, motivo: "" }],
  feriados: [],
} as unknown as ObraBanco;

describe("lançar mês (M11)", () => {
  it("data-base do mês segue as trocas de tabela", () => {
    expect(dataBaseNoMes(b, 1)).toBe(2025);
    expect(dataBaseNoMes(b, 2)).toBe(2026);
    expect(dataBaseNoMes(b, 3)).toBe(2026);
  });
  it("o mês é uma obra de 1 mês na competência dele, com cidade, área e regime da obra", () => {
    const r = rascunhoDoMes(b, 3);
    expect(r.dados).toMatchObject({
      inicio: { ano: 2026, mes: 2 },
      meses: 1,
      dataBase: 2026,
      cidadeId: "bh",
      area: 1000,
      regime: { ped: "sp" },
    });
    expect(r.leituras).toBeNull();
  });
});
