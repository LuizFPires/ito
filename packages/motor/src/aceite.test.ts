/**
 * Aceite do M3 (PLAN): todos os golden do SPEC §8 num lugar só, e recálculo de uma projeção de
 * 24 meses × 15 funções em menos de 300 ms.
 */
import { describe, expect, it } from "vitest";
import { calendarioMes } from "./calendario";
import { ENCARGOS_REFERENCIA, taxasEncargos } from "./encargos";
import { vtDiario, vtDiarioDe } from "./local";
import type { Contexto } from "./modelo";
import { calcularObra } from "./obra";
import { aplicarReajuste, reajusteDaProjecao, salarioDe, tabelaDaCidade } from "./parametros";
import { projetar } from "./projecao";
import {
  carregarPrototipo,
  cctDe,
  cidadeDe,
  contextoDe,
  entradaProjecaoDe,
  obraDe,
  parametrosDe,
  tabelaDe,
} from "./prototipo.harness";
import { conferirFolha } from "./rubricas";

const P = carregarPrototipo();
const ctx = contextoDe(P);
/* eslint-disable @typescript-eslint/no-explicit-any -- dados do protótipo */

describe("golden SPEC §8", () => {
  it("encargos sociais CLT 43,96%, provisões 22,64%, S/P 6,65%", () => {
    const t = taxasEncargos(ENCARGOS_REFERENCIA);
    expect(t.soc.clt * 100).toBeCloseTo(43.96, 2);
    expect(t.prov.clt * 100).toBeCloseTo(22.64, 2);
    expect(t.nf.sp * 100).toBeCloseTo(6.65, 2);
  });

  it("calendário 2017: fev 24/4, abr 23/7, mai 26/5", () => {
    const op = { carnaval: false, corpusChristi: true, feriadosEmpresa: [] };
    const r = [2, 4, 5].map((m) => calendarioMes(2017, m, op));
    expect(r.map((c) => [c.uteis, c.rep])).toEqual([
      [24, 4],
      [23, 7],
      [26, 5],
    ]);
  });

  it("conferência da folha: diferença R$ 0,00 em todas as obras de exemplo", () => {
    const dic = P.D.rubricas.map((r: any) => ({ codigo: r.cod, tipo: r.tipo, componente: r.comp }));
    for (const po of P.D.obras) {
      const r = calcularObra(obraDe(P, po), parametrosDe(P.pObra(po)), ctx);
      for (const m of conferirFolha(r.porMes, dic))
        expect(Math.abs(m.diferenca)).toBeLessThan(0.005);
    }
  });

  it("reajuste automático: Vespasiano mar–nov/27, CCT BH (mai, 6%): 1.400 → 1.484", () => {
    const cct = cctDe(P.D.ccts.find((t: any) => t.id === "bh"));
    const cid = cidadeDe(P.D.cidades.find((c: any) => c.id === "vespasiano"));
    const inicio = { ano: 2027, mes: 3 };
    const p = aplicarReajuste(
      tabelaDaCidade(tabelaDe(P.pVig()), cct, cid),
      9,
      reajusteDaProjecao(inicio, 9, null, cct),
    );
    const ped = (i: number) => salarioDe(typeof p === "function" ? p(i) : p, "ped");
    expect([ped(1), ped(2)]).toEqual([1400, 1484]);
  });

  it("VT por origem: Vespasiano R$ 24,80 vindo de BH × R$ 11,00 local", () => {
    const vesp = cidadeDe(P.D.cidades.find((c: any) => c.id === "vespasiano"));
    const bh = cidadeDe(P.D.cidades.find((c: any) => c.id === "bh"));
    expect(vtDiario(vesp)).toBeCloseTo(11, 10);
    expect(vtDiarioDe(vesp, bh)).toEqual({ valor: 24.8, estimado: false });
  });
});

describe("desempenho (aceite M3)", () => {
  it("projeção de 24 meses × 15 funções recalcula em menos de 300 ms", () => {
    // 15 funções: as 14 do protótipo + uma extra que escala com a área
    const extra = { ...ctx.funcoes[0]!, id: "extra" };
    const ctx15: Contexto = { ...ctx, funcoes: [...ctx.funcoes, extra] };
    expect(ctx15.funcoes).toHaveLength(15);
    const p = { ...P.D.projecoes[0], prazo: 24, refs: P.D.obras.map((o: any) => o.id) };
    // carga cheia: as 15 funções com efetivo nos 24 meses (quantidades informadas)
    const entrada = {
      ...entradaProjecaoDe(P, p),
      quantidadesManuais: Object.fromEntries(
        ctx15.funcoes.map((f, j) => [
          f.id,
          Array.from({ length: 24 }, (_, i) => 2 + ((i + j) % 9)),
        ]),
      ),
    };
    const base = tabelaDe(P.pVig());
    const params = { ...base, salarios: { ...base.salarios, extra: 1500 } };

    projetar(entrada, params, ctx15); // aquece
    const vezes = 5;
    const t0 = performance.now();
    for (let k = 0; k < vezes; k++) {
      const r = projetar(entrada, params, ctx15)!;
      expect(r.resultado.n).toBe(24);
      expect(r.resultado.funcoes).toHaveLength(15);
    }
    const ms = (performance.now() - t0) / vezes;
    console.info(`projeção 24 × 15: ${Math.round(ms * 10) / 10} ms por recálculo`);
    expect(ms).toBeLessThan(300);
  });
});
