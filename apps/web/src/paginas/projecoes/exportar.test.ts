import { describe, expect, it } from "vitest";
import { CTX, TABELA } from "../../../../../packages/carga/src/fixtures";
import type { CidadeComPrecos } from "../../lib/projecaoDoBanco";
import { calcularProjecao, cenarios, entradasVazias } from "../../lib/projecaoDoBanco";
import { tabelasDaProjecao } from "./exportar";

const vespasiano: CidadeComPrecos = {
  id: "vespasiano",
  nome: "Vespasiano/MG",
  cctId: "bh",
  tarifaLocal: 5.5,
  conducoes: 1,
  issPct: 2,
  passagens: { bh: 12.4 },
  feriados: [],
};
const bh = { ...vespasiano, id: "bh", nome: "Belo Horizonte/MG", passagens: {} };
const cct = {
  mesDataBase: 5,
  reajusteEstimadoPct: 6,
  salarios: { ped: 1400 },
  gratificacoes: {},
  beneficios: {},
};
const e = {
  ...entradasVazias(new Date(2026, 9, 21)),
  nome: "Golden",
  cidadeId: "vespasiano",
  inicio: { ano: 2027, mes: 3 },
  prazo: 9,
  area: 4800,
  quantidadesManuais: { ped: Array(9).fill(5) },
};
const calc = calcularProjecao(
  e,
  [],
  { vigente: TABELA, cidade: vespasiano, cidadeOrigem: bh, cct },
  CTX,
);

describe("exportar a projeção", () => {
  const tabelas = tabelasDaProjecao({
    e,
    calc,
    ids: ["ped"],
    fun: (k) => ({
      id: k,
      nome: k === "ped" ? "Pedreiro" : k,
      grupo: "direta",
      cor: "",
      estagio: false,
    }),
    cidade: "Vespasiano/MG",
    cct: "BH e região metropolitana",
    origem: "Belo Horizonte/MG",
    vigente: 2026,
    caixa: false,
    cenarios: cenarios(calc, CTX),
    referencias: [],
  });

  it("abas na ordem da tela", () => {
    expect(tabelas.map((t) => t.aba)).toEqual([
      "Premissas",
      "Efetivo",
      "Custo por função",
      "Custo por componente",
      "Trazer gente de fora",
      "Projeção × referências",
    ]);
  });

  it("premissas com o reajuste da data-base e o total igual ao do custo", () => {
    const p = new Map(tabelas[0]!.linhas.map((l) => [l[0], l[1]]));
    expect(p.get("Reajustes")).toBe("Reajuste de 6,0% em mai/27 (data-base da CCT)");
    const custo = tabelas[2]!.linhas.at(-1)!;
    // soma de células em centavos: até alguns centavos do total do motor
    expect(Math.abs((custo.at(-1) as number) - calc.r!.total)).toBeLessThan(0.05);
    expect(tabelas[1]!.linhas.at(-1)!.at(-1)).toBe(45);
  });

  it("cenários com a diferença contra o planejado", () => {
    const c = tabelas[4]!.linhas;
    expect(c[0]![4]).toBeNull();
    expect(c[1]![0]).toBe("Toda a mão de obra local");
    expect(c[2]![0]).toBe("Toda vindo de Belo Horizonte/MG todo dia");
  });
});
