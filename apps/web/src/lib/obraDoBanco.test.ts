import { ESCOLHAS_VAZIAS, montarCarga } from "@ito/carga";
import type { CargaParaGravar } from "@ito/carga";
import { calcularObra } from "@ito/motor";
import { describe, expect, it } from "vitest";
// fixtures sintéticas da carga (só matrícula)
import { CADASTRO, CTX, DADOS, FOLHA, TABELA } from "../../../../packages/carga/src/fixtures";
import type { ObraBanco } from "./obraDoBanco";
import { calcular, diasDoPeriodo, obraDoBanco, resumoDaObra } from "./obraDoBanco";

const ESCOLHAS = {
  ...ESCOLHAS_VAZIAS,
  rubricasNovas: {
    7777: {
      nome: "PRÊMIO",
      tipo: "provento" as const,
      componente: "extras" as const,
      baseProvisoes: true,
      tipoHe: null,
    },
  },
  realocacao: { "OBRA B": { nome: "Obra B", obraId: null } },
};

/** O que `gravar_carga` grava, como o banco devolve (efetivo derivado como no SQL). */
function comoNoBanco(p: CargaParaGravar): ObraBanco {
  const o = p.obra as Record<string, unknown>;
  const efetivo = new Map<string, ObraBanco["efetivo"][number]>();
  for (const l of p.lancamentos) {
    if (l.realocada_para) continue;
    const k = `${l.funcao_id}|${l.mes_idx}`;
    const e = efetivo.get(k) ?? {
      obra_id: String(o.id),
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
      ...(o as object),
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
      obra_id: String(o.id),
    })) as unknown as ObraBanco["competencias"],
    efetivo: [...efetivo.values()],
    regime: p.regime,
    trocas: p.trocas,
    feriados: p.feriados,
  };
}

describe("obra da base histórica → motor", () => {
  const m = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, ESCOLHAS, TABELA);
  const banco = comoNoBanco(m.payload);

  it("ida e volta pelo banco: o motor dá o mesmo custo, mês a mês, até o centavo", () => {
    const direto = calcularObra(m.obra, TABELA, CTX, { movimentos: m.movimentos });
    const { obra, movimentos } = obraDoBanco(banco);
    const doBanco = calcularObra(obra, TABELA, CTX, { movimentos });
    expect(doBanco.n).toBe(direto.n);
    for (let i = 0; i < direto.n; i++)
      expect(Math.abs(doBanco.porMes[i]!.total - direto.porMes[i]!.total)).toBeLessThan(0.005);
  });

  it("resumo como no protótipo: pico, pessoa-mês, HE ponderada e % indireta", () => {
    const tabelas = {
      2025: TABELA,
      2026: { ...TABELA, salarios: { ...TABELA.salarios, ped: 1800 } },
    };
    const r = resumoDaObra(banco, CTX, tabelas, 2026);
    // efetivo: mar 1 ped + 1 serv = 2; abr 1,5 ped (servente realocado)
    expect(r.histograma).toEqual([2, 1.5]);
    expect(r.pico).toBe(2);
    expect(r.pessoa_mes).toBe(3.5);
    expect(r.indireta_pct).toBe(0);
    expect(r.custo_atual).toBeGreaterThan(r.custo_epoca); // pedreiro mais caro na vigente
  });

  it("dias corridos das competências", () => {
    expect(diasDoPeriodo("2025-03-01", 2)).toBe(61);
    expect(diasDoPeriodo("2024-02-01", 1)).toBe(29);
  });
});

describe("snapshot dos números das abas (aceite M5)", () => {
  it("época e atualizado, mês a mês e por componente, travados no centavo", () => {
    const m = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, ESCOLHAS, TABELA);
    const banco = comoNoBanco(m.payload);
    const tabelas = {
      2025: TABELA,
      2026: { ...TABELA, salarios: { ...TABELA.salarios, ped: 1800, serv: 1200 } },
    };
    const c = (v: number) => Math.round(v * 100) / 100;
    const foto = (["epoca", "atualizado"] as const).map((visao) => {
      const r = calcular(banco, CTX, tabelas, 2026, visao);
      return {
        visao,
        porMes: r.porMes.map((x) => ({
          x: c(x.x),
          salv: c(x.salv),
          extras: c(x.extras),
          he: c(x.he),
          dsr: c(x.dsr),
          enc: c(x.enc),
          prov: c(x.prov),
          vt: c(x.vt),
          benef: c(x.benef),
          exames: c(x.exames),
          resc: c(x.resc),
          total: c(x.total),
          caixa: c(x.caixa),
        })),
        porGrupo: Object.fromEntries(Object.entries(r.porGrupo).map(([g, v]) => [g, c(v)])),
      };
    });
    expect(foto).toMatchSnapshot();
  });
});
