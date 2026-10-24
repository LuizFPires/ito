/**
 * Casos da revisão do M3 que as obras de exemplo do protótipo não exercitam: entrada inválida,
 * duração da obra, quantidade fixa sem cabeças, curva só das referências com a função (decisão
 * M3), alojada sem cidade, premissas zeradas, indicadores (§4.7) e desempenho pelo caminho
 * completo da projeção (curvas + cenários).
 */
import { describe, expect, it } from "vitest";
import type { Obra } from "./modelo";
import { nMeses } from "./modelo";
import { ErroEntradaMotor, calcularObra, indicadores, validarObra } from "./obra";
import { cenariosDeOrigem, projetar } from "./projecao";
import type { EntradaProjecao } from "./projecao";
import { carregarPrototipo, contextoDe, entradaProjecaoDe, tabelaDe } from "./prototipo.harness";

const P = carregarPrototipo();
const ctx = contextoDe(P);
const tabela = tabelaDe(P.pVig());
const SINT = { movimentos: "sinteticos" } as const;

function obra(equivalente: Record<string, number[]>, extra: Partial<Obra> = {}): Obra {
  const n = Math.max(...Object.values(equivalente).map((v) => v.length));
  return {
    id: "sintetica",
    inicio: { ano: 2026, mes: 3 },
    area: 1000,
    equivalente,
    heMedia: Array(n).fill(10),
    absenteismoPct: Array(n).fill(3),
    licencaPessoaDias: Array(n).fill(0),
    feriasPessoaDias: Array(n).fill(0),
    rotatividadePct: 5,
    ...extra,
  };
}

const entrada = (referencias: Obra[], extra: Partial<EntradaProjecao> = {}): EntradaProjecao => ({
  inicio: { ano: 2027, mes: 3 },
  prazo: 4,
  area: 1000,
  referencias,
  estatistica: "media",
  vtDiariaReferencia: tabela.vtDiaria,
  ...extra,
});

describe("entrada do cálculo da obra", () => {
  it("função com efetivo fora do cadastro é erro, não some do custo", () => {
    expect(() => calcularObra(obra({ ped: [5], xyz: [2] }), tabela, ctx, SINT)).toThrow(
      ErroEntradaMotor,
    );
  });

  it("validarObra aceita a obra boa e aponta NaN, negativo, percentual e mix de HE", () => {
    expect(validarObra(obra({ ped: [5, 5] }))).toEqual([]);
    const ruim = obra(
      { ped: [5, -1] },
      {
        heMedia: [Number.NaN, 10],
        absenteismoPct: [3, 120],
        heMixPct: { util: 70, sabado: 15, intervalo: 5, feriado: 0 },
      },
    );
    const erros = validarObra(ruim);
    expect(erros).toHaveLength(4);
    expect(erros.join(" ")).toContain("Mix de HE soma 90%");
    expect(() => calcularObra(ruim, tabela, ctx, SINT)).toThrow(ErroEntradaMotor);
  });

  it("duração: `meses` quando informado; senão a maior série (não trunca efetivo)", () => {
    expect(nMeses(obra({ ped: [5, 5] }, { meses: 6 }))).toBe(6);
    expect(nMeses(obra({ ped: [5, 5, 5, 5] }, { heMedia: [10, 10] }))).toBe(4);
    expect(calcularObra(obra({ ped: [5, 5, 5, 5] }, { heMedia: [10] }), tabela, ctx, SINT).n).toBe(
      4,
    );
  });
});

describe("premissas zeradas valem como zero (não caem no padrão)", () => {
  it("transferência de 0% não paga adicional", () => {
    const o = obra({ ped: [5, 5] }, { premissas: { funcoesTransferidas: ["ped"], transfPct: 0 } });
    const r = calcularObra(o, tabela, ctx, SINT);
    expect(r.porFuncao.ped![0]!.adicionais.transf).toBe(0);
  });

  it("adiantamento de 0%: a folha inteira sai no mês seguinte", () => {
    const o = obra({ ped: [5, 5] }, { premissas: { adiantamento: true, adiantamentoPct: 0 } });
    const c = calcularObra(o, tabela, ctx, SINT).porFuncao.ped!;
    expect(c[0]!.saldoFolha).toBeCloseTo(c[0]!.remun, 10);
    expect(c[1]!.saldoFolha).toBe(0);
  });
});

describe("projeção de quantidades (§5)", () => {
  // A tem pedreiro (escala com área) no meio da obra e mestre (fixo) sem cabeças; B não tem nenhum
  const A = obra({
    ped: [0, 10, 10, 0],
    mestre: [0.4, 1.2, 1.2, 0.4],
    serv: [2, 2, 2, 2],
  });
  const B = obra({ serv: [3, 3, 3, 3] }, { id: "b" });

  it("curva no tempo só das referências que têm a função; PM inclui o zero de quem não tem", () => {
    const r = projetar(entrada([A, B]), tabela, ctx)!;
    // PM/1.000 m²: média(20, 0) = 10; curva só de A: 0, ½, ½, 0
    expect(r.pmPorMilM2.ped).toBeCloseTo(10, 10);
    expect(r.obra.equivalente.ped).toEqual([0, 5, 5, 0]);
  });

  it("quantidade fixa sem cabeças usa o teto do equivalente", () => {
    const r = projetar(entrada([A]), tabela, ctx)!;
    // cabeças de A = ⌈0,4⌉, ⌈1,2⌉… = 1, 2, 2, 1 → média 1,5 → 2 por mês
    expect(r.obra.equivalente.mestre).toEqual([2, 2, 2, 2]);
  });

  it("alojada não tem VT, mesmo sem cidade", () => {
    const r = projetar(entrada([A], { origem: { ped: "aloj" } }), tabela, ctx)!;
    expect(r.obra.vtDiariaPorFuncao!.ped).toBe(0);
    expect(r.resultado.porFuncao.ped!.every((c) => c.vt === 0)).toBe(true);
    expect(r.obra.vtDiariaPorFuncao!.serv).toBe(tabela.vtDiaria);
  });

  it("prazo zero não projeta", () => {
    expect(projetar(entrada([A], { prazo: 0 }), tabela, ctx)).toBeNull();
  });
});

describe("indicadores derivados (§4.7)", () => {
  it("R$/dia, encargos % e benefícios %", () => {
    const r = calcularObra(obra({ ped: [6, 6], mestre: [1, 1], admin: [1, 1] }), tabela, ctx, SINT);
    const t = r.total;
    const ind = indicadores(r);
    expect(ind.porDiaComTaxa).toBeCloseTo(t.total / t.dias, 10);
    expect(ind.porDiaSemTaxa).toBeCloseTo(t.remun / t.dias, 10);
    expect(ind.encargosPct).toBeCloseTo(((t.enc + t.prov + t.nf) / t.remun) * 100, 10);
    expect(ind.beneficiosPct).toBeCloseTo(((t.vt + t.benef) / t.remun) * 100, 10);
  });
});

describe("desempenho pelo caminho completo (curvas das referências + cenários de origem)", () => {
  it("projeção de 24 meses com todas as referências e os 3 cenários em menos de 300 ms", () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados do protótipo */
    const base = P.D.projecoes.find((p: any) => p.cidade);
    const p = { ...base, prazo: 24, refs: P.D.obras.map((o: { id: string }) => o.id) };
    const e = entradaProjecaoDe(P, p);
    cenariosDeOrigem(e, tabela, ctx); // aquece
    const t0 = performance.now();
    const r = projetar(e, tabela, ctx)!;
    const cen = cenariosDeOrigem(e, tabela, ctx);
    const ms = performance.now() - t0;
    expect(r.resultado.n).toBe(24);
    expect(cen.length).toBeGreaterThanOrEqual(3);
    console.info(`projeção 24 meses + cenários: ${Math.round(ms * 10) / 10} ms`);
    expect(ms).toBeLessThan(300);
  });
});

describe("mais ou menos gente sobre as quantidades informadas (24/10/2026)", () => {
  it("a régua multiplica o histograma informado, com pessoas inteiras", () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados do protótipo */
    const base = P.D.projecoes.find((p: any) => p.cidade);
    const e = entradaProjecaoDe(P, { ...base, prazo: 3 });
    const informado = { ...e, quantidadesManuais: { ped: [4, 10, 3] } };
    expect(projetar(informado, tabela, ctx)!.obra.equivalente.ped).toEqual([4, 10, 3]);
    // +20%: 4,8 → 5; 12 → 12; 3,6 → 4
    const mais = projetar({ ...informado, ajustesPct: { ped: 20 } }, tabela, ctx)!;
    expect(mais.obra.equivalente.ped).toEqual([5, 12, 4]);
    // −100%: a função sai do histograma
    const menos = projetar({ ...informado, ajustesPct: { ped: -100 } }, tabela, ctx)!;
    expect(menos.obra.equivalente.ped).toEqual([0, 0, 0]);
  });
});
