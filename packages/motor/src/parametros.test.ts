import { describe, expect, it } from "vitest";
import { ENCARGOS_REFERENCIA } from "./encargos";
import { tabelaDoMes } from "./modelo";
import type { Tabela } from "./modelo";
import {
  aplicarReajustes,
  parametrosEpoca,
  reajustesDaProjecao,
  salarioDe,
  tabelaDaCidade,
} from "./parametros";

const base = (ped: number): Tabela => ({
  salarios: { ped, serv: 1110 },
  beneficios: { refeicao: 220 },
  gratificacoes: {},
  encargos: ENCARGOS_REFERENCIA,
  heAdicionalPct: { util: 100, sabado: 100, intervalo: 50, feriado: 100 },
  divisor: 220,
  modoDias: "calendario",
  sabadoTrabalhado: false,
  diasFixos: 22,
  dsrFixoPct: 20,
  vtDiaria: 11.6,
  fatorRescisao: 0.9,
  salarioMinimo: 1621,
  adicionalNoturnoPct: 20,
  salarioFamilia: { teto: 1980.38, cota: 67.54 },
});

const ccBh = {
  mesDataBase: 5,
  reajusteEstimadoPct: 6,
  salarios: { ped: 1400 },
  gratificacoes: { mestre: 600 },
  beneficios: {},
};
const vespasiano = {
  id: "vespasiano",
  tarifaLocal: 5.5,
  conducoes: 1,
  passagens: { bh: 12.4 },
  issPct: 2,
};

describe("reajuste automático — golden SPEC §8", () => {
  // Projeção em Vespasiano de mar/27 a nov/27 (9 meses), CCT BH, data-base maio, 6%
  const inicio = { ano: 2027, mes: 3 };
  const prazo = 9;

  it("data-base de maio cai no mês 2 (mai/27)", () => {
    expect(reajustesDaProjecao(inicio, prazo, null, ccBh)).toEqual([
      { mesIdx: 2, pct: 6, automatico: true },
    ]);
  });

  it("pedreiro 1.400 até abr/27 e 1.484 a partir de mai/27", () => {
    const p0 = tabelaDaCidade(base(1300), ccBh, vespasiano);
    const p = aplicarReajustes(p0, prazo, reajustesDaProjecao(inicio, prazo, null, ccBh));
    const ped = (i: number) => salarioDe(tabelaDoMes(p, i), "ped");
    expect([ped(0), ped(1)]).toEqual([1400, 1400]);
    expect([ped(2), ped(8)]).toEqual([1484, 1484]);
  });

  it("reajuste informado vence o automático", () => {
    expect(reajustesDaProjecao(inicio, prazo, { mesIdx: 4, pct: 5 }, ccBh)).toEqual([
      { mesIdx: 4, pct: 5, automatico: false },
    ]);
  });

  it("informado com 0% significa sem reajuste (não cai no automático)", () => {
    expect(reajustesDaProjecao(inicio, prazo, { mesIdx: 3, pct: 0 }, ccBh)).toEqual([]);
  });

  it("data-base no mês 0 não conta (só i ≥ 1); fora do prazo não há reajuste", () => {
    expect(reajustesDaProjecao({ ano: 2027, mes: 5 }, 3, null, ccBh)).toEqual([]);
  });

  it("obra longa: um reajuste por data-base, composto (decisão M3)", () => {
    const r = reajustesDaProjecao(inicio, 24, null, ccBh);
    expect(r.map((x) => x.mesIdx)).toEqual([2, 14]);
    const p = aplicarReajustes(tabelaDaCidade(base(1300), ccBh, vespasiano), 24, r);
    const ped = (i: number) => salarioDe(tabelaDoMes(p, i), "ped");
    expect([ped(1), ped(2), ped(13), ped(14), ped(23)]).toEqual([
      1400, 1484, 1484, 1573.04, 1573.04,
    ]);
  });
});

describe("tabelaDaCidade (SPEC §3)", () => {
  const t = tabelaDaCidade(base(1300), ccBh, vespasiano);
  it("salários e gratificações da CCT; o que falta fica o da empresa", () => {
    expect(t.salarios.ped).toBe(1400);
    expect(t.salarios.serv).toBe(1110);
    expect(t.gratificacoes.mestre).toBe(600);
  });
  it("VT da cidade = tarifa × conduções × 2 e ISS da cidade", () => {
    expect(t.vtDiaria).toBeCloseTo(11, 10);
    expect(t.encargos.find((e) => e.id === "iss")?.aliqSp).toBe(2);
  });
});

describe("parametrosEpoca (trocas de tabela no meio da obra)", () => {
  const tabelas = { 2024: base(1200), 2025: base(1300), 2026: base(1400) };
  it("sem trocas, uma tabela só", () => {
    const p = parametrosEpoca(tabelas, 2024, [], 2026);
    expect(salarioDe(tabelaDoMes(p, 5), "ped")).toBe(1200);
  });
  it("troca no mês 3 passa a valer a partir dele", () => {
    const p = parametrosEpoca(tabelas, 2024, [{ mesIdx: 3, dataBase: 2025 }], 2026);
    expect([2, 3, 7].map((i) => salarioDe(tabelaDoMes(p, i), "ped"))).toEqual([1200, 1300, 1300]);
  });
});

describe("salarioDe", () => {
  it("sem salário da função usa o do oficial", () => {
    expect(salarioDe(base(1400), "nova")).toBe(1400);
  });
});
