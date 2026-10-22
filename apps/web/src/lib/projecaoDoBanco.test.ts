import { tabelaDoMes } from "@ito/motor";
import { describe, expect, it } from "vitest";
import { CTX, TABELA } from "../../../../packages/carga/src/fixtures";
import type { CidadeComPrecos, Entradas, LinhaProjecao } from "./projecaoDoBanco";
import {
  calcularProjecao,
  entradasDaLinha,
  entradasVazias,
  linhaDasEntradas,
  maisParecidas,
} from "./projecaoDoBanco";

// Vespasiano (CCT BH, maio, 6%) e BH: o golden do SPEC §8
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
const bh: CidadeComPrecos = {
  ...vespasiano,
  id: "bh",
  nome: "Belo Horizonte/MG",
  tarifaLocal: 6.25,
  passagens: {},
};
const cctBh = {
  mesDataBase: 5,
  reajusteEstimadoPct: 6,
  salarios: { ped: 1400 },
  gratificacoes: {},
  beneficios: {},
};

const manual = (n: number) => ({ ped: Array(n).fill(5), serv: Array(n).fill(3) });
const entradas = (p: Partial<Entradas> = {}): Entradas => ({
  ...entradasVazias(new Date(2026, 9, 21)),
  nome: "Golden",
  cidadeId: "vespasiano",
  inicio: { ano: 2027, mes: 3 },
  prazo: 9,
  area: 4800,
  quantidadesManuais: manual(9),
  ...p,
});
const precos = { vigente: TABELA, cidade: vespasiano, cidadeOrigem: bh, cct: cctBh };

describe("projeção: preços da cidade e reajuste (golden SPEC §8)", () => {
  it("reajuste automático: pedreiro 1.400 até abr/27 e 1.484 a partir de mai/27", () => {
    const c = calcularProjecao(entradas(), [], precos, CTX);
    expect(tabelaDoMes(c.parametros, 1).salarios.ped).toBe(1400);
    expect(tabelaDoMes(c.parametros, 2).salarios.ped).toBe(1484);
    expect(c.reajustes).toEqual([{ mesIdx: 2, pct: 6, automatico: true }]);
  });

  it("reajuste informado com 0% = sem reajuste", () => {
    const c = calcularProjecao(entradas({ reajuste: { mesIdx: 4, pct: 0 } }), [], precos, CTX);
    expect(tabelaDoMes(c.parametros, 8).salarios.ped).toBe(1400);
  });

  it("VT por origem: R$ 11,00 local × R$ 24,80 vindo de BH todo dia", () => {
    const local = calcularProjecao(entradas(), [], precos, CTX);
    const diaria = calcularProjecao(entradas({ origem: { ped: "diaria" } }), [], precos, CTX);
    expect(local.r!.obra.vtDiariaPorFuncao!.ped).toBeCloseTo(11, 10);
    expect(diaria.r!.obra.vtDiariaPorFuncao!.ped).toBeCloseTo(24.8, 10);
  });

  it("sem cidade: tabela vigente, sem reajuste da CCT", () => {
    const c = calcularProjecao(
      entradas({ cidadeId: null }),
      [],
      { ...precos, cidade: null, cct: null },
      CTX,
    );
    expect(tabelaDoMes(c.parametros, 8).salarios.ped).toBe(TABELA.salarios.ped);
    expect(c.r).not.toBeNull();
  });
});

describe("entradas ↔ banco", () => {
  it("ida e volta pela linha do banco", () => {
    const e = entradas({
      reajuste: { mesIdx: 4, pct: 5 },
      ajustes: { ped: 10 },
      origem: { ped: "aloj" },
    });
    const linha = {
      ...linhaDasEntradas(e),
      id: "x",
      situacao: "rascunho",
      resumo: {},
    } as unknown as LinhaProjecao;
    expect(entradasDaLinha(linha)).toEqual(e);
  });
});

describe("5 mais parecidas", () => {
  it("mesma tipologia primeiro, depois área e prazo", () => {
    const o = (id: string, tipologia: string, area: number, meses: number) => ({
      id,
      tipologia,
      area_m2: area,
      meses,
    });
    const obras = [
      o("a", "Comercial", 4800, 9),
      o("b", "Galpão logístico", 9000, 12),
      o("c", "Galpão logístico", 4000, 8),
      o("d", "Galpão logístico", 4800, 9),
    ];
    const r = maisParecidas({ tipologia: "Galpão logístico", area: 5000, prazo: 9 }, obras, 3);
    expect(r.map((x) => x.id)).toEqual(["d", "c", "b"]);
  });
});
