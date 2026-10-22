import { describe, expect, it } from "vitest";
import { porConstrutora } from "./calculos";

describe("efetivo e folha por construtora (M9)", () => {
  it("separa Clássica e Ampla, sem a MDO realocada", () => {
    const l = (
      matricula: string,
      construtora: string,
      eq: number,
      realocada: string | null = null,
    ) => ({
      mes_idx: 0,
      matricula,
      funcao_id: "ped",
      construtora,
      equivalente: eq,
      realocada_para: realocada,
    });
    const r = (matricula: string, construtora: string, codigo: number, valor: number) => ({
      mes_idx: 0,
      matricula,
      funcao_id: "ped",
      construtora,
      rubrica_codigo: codigo,
      valor,
    });
    const res = porConstrutora(
      [l("1", "classica", 1), l("1", "ampla", 0.5), l("2", "ampla", 1, "Outra")],
      [
        r("1", "classica", 1, 1000),
        r("1", "ampla", 1, 500),
        r("1", "ampla", 40, 50),
        r("2", "ampla", 1, 900),
      ],
      new Map([
        [1, "provento"],
        [40, "desconto"],
      ]),
      1,
    );
    expect(res).toEqual([
      { construtora: "classica", pm: [1], cabecas: [1], remun: [1000] },
      { construtora: "ampla", pm: [0.5], cabecas: [1], remun: [450] },
    ]);
  });
});
