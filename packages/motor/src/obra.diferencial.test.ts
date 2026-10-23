/**
 * Validação diferencial (decisão M3): movimentos, totais por mês, total, caixa com
 * adiantamento e total da obra iguais ao protótipo ITO 2.0, nas 5 obras de exemplo.
 */
import { describe, expect, it } from "vitest";
import { movimentos } from "./movimentos";
import { calcularObra } from "./obra";
import { carregarPrototipo, contextoDe, obraDe, parametrosDe } from "./prototipo.harness";

const P = carregarPrototipo();
const ctx = contextoDe(P);
const CENTAVO = 0.005;
const CASOS: [string, number][] = P.D.obras.map((o: { nome: string }, j: number) => [o.nome, j]);

describe.each(CASOS)("obra = protótipo · %s", (_nome: string, j: number) => {
  const po = P.D.obras[j];
  const obra = obraDe(P, po);
  const ref = P.calc(po, P.pObra(po));
  const r = calcularObra(obra, parametrosDe(P.pObra(po)), ctx, { movimentos: "sinteticos" });

  it("admissões e desligamentos (§4.6, sorteio determinístico)", () => {
    const m = movimentos(
      obra,
      ctx.funcoes.map((f) => f.id),
    );
    const pm = P.movimentos(po);
    expect(m.admissoes).toEqual(pm.adm);
    expect(m.desligamentos).toEqual(pm.dem);
  });

  it("totais por mês: total, remun, encargos, provisões, VT, benefícios e caixa (§4.5)", () => {
    expect(r.n).toBe(ref.n);
    for (let i = 0; i < r.n; i++) {
      for (const [nosso, deles] of [
        ["total", "tot"],
        ["remun", "remun"],
        ["enc", "enc"],
        ["prov", "prov"],
        ["vt", "vt"],
        ["benef", "benef"],
        ["caixa", "caixa"],
        ["exames", "exames"],
        ["resc", "resc"],
        ["x", "x"],
      ] as const) {
        expect(Math.abs(r.porMes[i]![nosso] - ref.M[i][deles])).toBeLessThan(CENTAVO);
      }
    }
  });

  it("total da obra", () => {
    expect(Math.abs(r.total.total - ref.tot)).toBeLessThan(CENTAVO);
    expect(Math.abs(r.total.caixa - ref.caixa)).toBeLessThan(CENTAVO);
  });

  it("caixa: o adiantamento só desloca no tempo (total do período não muda, §4.5)", () => {
    const semAdiant = calcularObra(
      { ...obra, premissas: { ...obra.premissas, adiantamento: false } },
      parametrosDe(P.pObra(po)),
      ctx,
      { movimentos: "sinteticos" },
    );
    expect(Math.abs(r.total.caixa - semAdiant.total.caixa)).toBeLessThan(CENTAVO);
    expect(semAdiant.total.saldoFolha).toBe(0);
  });
});
