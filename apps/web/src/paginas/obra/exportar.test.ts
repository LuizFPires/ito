import { describe, expect, it } from "vitest";
import { rubricasPorMes, tabelaApropriacao, tabelaRubricas } from "./exportar";

const lanc = (mes_idx: number, matricula: string, realocada_para: string | null = null) => ({
  mes_idx,
  matricula,
  funcao_id: "ped",
  realocada_para,
});
const rub = (mes_idx: number, matricula: string, rubrica_codigo: number, valor: number) => ({
  mes_idx,
  matricula,
  funcao_id: "ped",
  rubrica_codigo,
  valor,
});

describe("exportar a obra", () => {
  it("rubricas somadas por código e mês, sem a MDO realocada e sem matrícula", () => {
    const m = rubricasPorMes(
      [lanc(0, "101"), lanc(0, "102", "Outra obra"), lanc(1, "101")],
      [
        rub(0, "101", 1, 1650),
        rub(0, "102", 1, 1650),
        rub(1, "101", 1, 1700),
        rub(0, "101", 900, 99),
      ],
      2,
    );
    expect(m.get(1)).toEqual([1650, 1700]);
    const cad = new Map([
      [1, { codigo: 1, nome: "Salário", tipo: "provento" }],
      [900, { codigo: 900, nome: "INSS", tipo: "desconto" }],
    ]);
    const t = tabelaRubricas(m, cad, ["jan/25", "fev/25"], ["Obra"]);
    expect(t.linhas.map((l) => l[1])).toEqual([
      "Salário",
      "INSS",
      "Proventos",
      "Descontos",
      "Líquido da folha",
    ]);
    // desconto com sinal negativo; nenhuma coluna de matrícula
    expect(t.linhas[1]).toEqual(["900", "INSS", "desconto", -99, 0, -99]);
    expect(t.linhas[4]).toEqual(["", "Líquido da folha", "", 1551, 1700, 3251]);
    expect(t.colunas.map((c) => c.titulo)).not.toContain("Matrícula");
  });

  it("apropriação com total por mês", () => {
    const t = tabelaApropriacao(
      [
        { conta: "04.02.07", nome: "Vale-transporte", v: [10, 20] },
        { conta: "04.03.01", nome: "Pedreiro", v: [100, 200] },
      ],
      ["jan/25", "fev/25"],
      ["Obra"],
    );
    expect(t.linhas.at(-1)).toEqual(["Total", "", 110, 220, 330]);
    expect(t.colunas[2]).toMatchObject({ formato: "moeda" });
  });
});
