/**
 * Projeção (SPEC §3, §5, §5.1) = protótipo ITO 2.0, e golden do SPEC §8 de reajuste automático e
 * de VT por origem, de ponta a ponta.
 */
import { describe, expect, it } from "vitest";
import { tabelaDoMes } from "./modelo";
import type { ParametrosObra } from "./modelo";
import { aplicarReajuste, reajusteDaProjecao, salarioDe, tabelaDaCidade } from "./parametros";
import { cenariosDeOrigem, projetar } from "./projecao";
import {
  carregarPrototipo,
  cctDe,
  cidadeDe,
  contextoDe,
  entradaProjecaoDe,
  tabelaDe,
} from "./prototipo.harness";

const P = carregarPrototipo();
const ctx = contextoDe(P);
const CENTAVO = 0.005;

/* eslint-disable @typescript-eslint/no-explicit-any -- dados do protótipo */
function parametrosProjecao(p: any): ParametrosObra {
  const vig = tabelaDe(P.pVig());
  const cid = p.cidade ? P.D.cidades.find((c: any) => c.id === p.cidade) : null;
  const cct = cid ? P.D.ccts.find((t: any) => t.id === cid.cct) : null;
  const base = cid && cct ? tabelaDaCidade(vig, cctDe(cct), cidadeDe(cid)) : vig;
  const inicio = { ano: p.ini.y, mes: p.ini.m + 1 };
  const reaj = reajusteDaProjecao(
    inicio,
    p.prazo,
    p.reaj ? { mesIdx: Number(p.reaj.i), pct: Number(p.reaj.pct) } : null,
    cct ? cctDe(cct) : null,
  );
  return aplicarReajuste(base, p.prazo, reaj);
}

const CASOS: [string, number][] = P.D.projecoes.map((p: any, j: number) => [p.nome, j]);

describe.each(CASOS)("projeção = protótipo · %s", (_nome: string, j: number) => {
  const p = P.D.projecoes[j];
  const params = parametrosProjecao(p);
  const ref = P.projetar(p);
  const r = projetar(entradaProjecaoDe(P, p), params, ctx);

  it("parâmetros por mês (cidade, CCT, VT, ISS e reajuste) iguais aos do protótipo", () => {
    const pp = P.pProj(p);
    for (let i = 0; i < p.prazo; i++) {
      const deles = typeof pp === "function" ? pp(i) : pp;
      const nosso = tabelaDoMes(params, i);
      for (const k of Object.keys(deles.sal))
        expect(Math.abs(salarioDe(nosso, k) - deles.sal[k])).toBeLessThan(CENTAVO);
      for (const k of Object.keys(deles.ben))
        expect(Math.abs((nosso.beneficios[k] ?? 0) - deles.ben[k])).toBeLessThan(CENTAVO);
      for (const k of Object.keys(deles.grat ?? {}))
        expect(Math.abs((nosso.gratificacoes[k] ?? 0) - deles.grat[k])).toBeLessThan(CENTAVO);
      expect(nosso.vtDiaria).toBeCloseTo(deles.vt, 10);
      expect(nosso.encargos.find((e) => e.id === "iss")?.aliqSp).toBe(
        deles.enc.find((e: any) => e.id === "iss").s,
      );
    }
  });

  it("quantidades, premissas aplicadas, totais por mês e total", () => {
    expect(r).not.toBeNull();
    expect(ref).not.toBeNull();
    for (const f of ctx.funcoes) expect(r!.obra.equivalente[f.id]).toEqual(ref.o.q[f.id]);
    expect(r!.aplicadas.heMedia).toBeCloseTo(ref.heAp, 10);
    expect(r!.aplicadas.absenteismoPct).toBeCloseTo(ref.absAp, 10);
    expect(r!.aplicadas.rotatividadePct).toBeCloseTo(ref.turnAp, 10);
    expect(r!.pessoaMes).toBeCloseTo(ref.mh, 10);
    expect(r!.pico).toBe(ref.pico);
    for (let i = 0; i < p.prazo; i++)
      expect(Math.abs(r!.resultado.porMes[i]!.total - ref.C.M[i].tot)).toBeLessThan(CENTAVO);
    expect(Math.abs(r!.total - ref.total)).toBeLessThan(CENTAVO);
  });

  it("cenários de origem (§5.1) iguais aos do protótipo", () => {
    if (!p.cidade) return; // sem cidade, a origem não muda o VT
    const nossos = cenariosDeOrigem(entradaProjecaoDe(P, p), params, ctx);
    for (const c of nossos.filter((x) => x.nome !== "planejado")) {
      const todos = Object.fromEntries(P.D.funcoes.map((f: any) => [f.k, c.nome]));
      const deles = P.projetar({ ...p, origem: todos });
      expect(Math.abs(c.total - deles.C.T.tot)).toBeLessThan(CENTAVO);
      expect(Math.abs(c.vt - deles.C.T.vt)).toBeLessThan(CENTAVO);
      expect(Math.abs(c.benef - deles.C.T.benef)).toBeLessThan(CENTAVO);
    }
  });
});

describe("golden SPEC §8 de ponta a ponta: projeção em Vespasiano, mar/27 a nov/27", () => {
  const vesp = P.D.cidades.find((c: any) => c.id === "vespasiano");
  const bh = P.D.cidades.find((c: any) => c.id === "bh");
  const cctBh = P.D.ccts.find((t: any) => t.id === "bh");
  const base = {
    id: "golden",
    nome: "Golden Vespasiano",
    ini: { y: 2027, m: 2 },
    prazo: 9,
    area: 4800,
    refs: ["paracatu"],
    stat: "media",
    cidade: "vespasiano",
    origemCid: "bh",
  };
  const params = parametrosProjecao(base);

  it("reajuste automático: pedreiro 1.400 até abr/27 e 1.484 a partir de mai/27", () => {
    expect(cctBh.mesBase + 1).toBe(5);
    const r = projetar(entradaProjecaoDe(P, base), params, ctx)!;
    const ped = r.resultado.porFuncao.ped!;
    expect([ped[0]!.salario, ped[1]!.salario]).toEqual([1400, 1400]);
    expect(ped.slice(2).every((c) => c.salario === 1484)).toBe(true);
  });

  it("VT diário: R$ 11,00 com MO local × R$ 24,80 com MO vindo de BH todo dia", () => {
    expect(vesp && bh).toBeTruthy();
    const todos = (og: string) => Object.fromEntries(ctx.funcoes.map((f) => [f.id, og]));
    const local = projetar(entradaProjecaoDe(P, base, todos("local")), params, ctx)!;
    const diaria = projetar(entradaProjecaoDe(P, base, todos("diaria")), params, ctx)!;
    expect(local.obra.vtDiariaPorFuncao!.ped).toBeCloseTo(11, 10);
    expect(diaria.obra.vtDiariaPorFuncao!.ped).toBeCloseTo(24.8, 10);
  });
});
