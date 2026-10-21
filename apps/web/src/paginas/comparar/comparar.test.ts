import { ESCOLHAS_VAZIAS, montarCarga } from "@ito/carga";
import { describe, expect, it } from "vitest";
import { CADASTRO, CTX, DADOS, FOLHA, TABELA } from "../../../../../packages/carga/src/fixtures";
import type { ObraBanco } from "../../lib/obraDoBanco";
import { compararObra, pontos } from "./comparar";

const ESC = {
  ...ESCOLHAS_VAZIAS,
  rubricasNovas: {
    7777: {
      nome: "P",
      tipo: "provento" as const,
      componente: "extras" as const,
      baseProvisoes: true,
      tipoHe: null,
    },
  },
  realocacao: { "OBRA B": { nome: "Obra B", obraId: null } },
};

/** Obra da fixture como o banco devolve (efetivo derivado como no SQL). */
function banco(): ObraBanco {
  const m = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, ESC, TABELA);
  const p = m.payload;
  const efetivo = new Map<string, ObraBanco["efetivo"][number]>();
  for (const l of p.lancamentos) {
    if (l.realocada_para) continue;
    const k = `${l.funcao_id}|${l.mes_idx}`;
    const e = efetivo.get(k) ?? {
      obra_id: "obra_teste",
      funcao_id: l.funcao_id,
      mes_idx: l.mes_idx,
      equivalente: 0,
      cabecas: 0,
      admissoes: 0,
      desligamentos: 0,
    };
    e.equivalente += l.equivalente;
    if (l.equivalente > 0) e.cabecas += 1;
    if (l.admitido) e.admissoes += 1;
    if (l.desligado) e.desligamentos += 1;
    efetivo.set(k, e);
  }
  return {
    obra: {
      ...(p.obra as object),
      revisao: 0,
      grat_premios_pct: 3,
      transf_pct: 25,
      funcoes_transferidas: [],
      risco_pct: 0,
      lucro_pct: 0,
      trib_lucro_pct: 0,
      provisionar: true,
      adiantamento: true,
      adiantamento_pct: 40,
    } as unknown as ObraBanco["obra"],
    competencias: p.competencias.map((c) => ({
      ...c,
      obra_id: "obra_teste",
    })) as unknown as ObraBanco["competencias"],
    efetivo: [...efetivo.values()],
    regime: p.regime,
    trocas: p.trocas,
    feriados: p.feriados,
  };
}

describe("comparar obras", () => {
  const t26 = { ...TABELA, salarios: { ...TABELA.salarios, ped: 1800 } };
  const o = compararObra(banco(), CTX, { 2025: TABELA, 2026: t26 }, 2026);

  it("sempre a preços vigentes (a tabela da época não entra)", () => {
    const ped = o.r.porFuncao.ped!.find((c) => c.x > 0)!;
    expect(ped.salario).toBe(1800);
  });

  it("indicadores do PRD §3.3", () => {
    // efetivo 2 e 1,5 pessoa-mês em 2.000 m²
    expect(o.ind.pico).toBe(2);
    expect(o.ind.pmPorMil).toBeCloseTo(1.75, 10);
    expect(o.ind.custoM2).toBeCloseTo(o.ind.custo / 2000, 10);
    expect(o.ind.diaPedreiro).toBeGreaterThan(0);
  });

  it("curvas por mês relativo e por % do prazo; curva S termina em 100%", () => {
    expect(pontos(o, "pessoas", "mes")).toEqual([
      [1, 1],
      [2, 0.75],
    ]);
    expect(pontos(o, "pessoas", "prazo")).toEqual([
      [0, 0],
      [25, 1],
      [75, 0.75],
      [100, 0],
    ]);
    const s = pontos(o, "custo", "prazo");
    expect(s[0]).toEqual([0, 0]);
    expect(s[s.length - 1]![0]).toBe(100);
    expect(s[s.length - 1]![1]).toBeCloseTo(100, 10);
  });
});
