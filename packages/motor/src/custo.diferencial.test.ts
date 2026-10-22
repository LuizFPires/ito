/**
 * Validação diferencial (decisão M3): o custo do motor = o do protótipo ITO 2.0, componente a
 * componente, para todas as obras de exemplo, funções e meses, até o centavo.
 */
import { describe, expect, it } from "vitest";
import { custoFuncaoMes } from "./custo";
import type { CustoMes } from "./custo";
import { carregarPrototipo, contextoDe, obraDe, parametrosDe } from "./prototipo.harness";

const P = carregarPrototipo();
const ctx = contextoDe(P);
const CENTAVO = 0.005;

// componente do motor → campo do protótipo
const PARES: [keyof CustoMes, string][] = [
  ["x", "x"],
  ["xa", "xa"],
  ["salario", "s"],
  ["a", "a"],
  ["licD", "licD"],
  ["ferD", "ferD"],
  ["dsrPct", "dsrP"],
  ["diasTrabalhados", "diasT"],
  ["faltasH", "faltasH"],
  ["faltasD", "faltasD"],
  ["faltas", "faltas"],
  ["salv", "salv"],
  ["bolsa", "bolsa"],
  ["extras", "extras"],
  ["horasPorPessoa", "h"],
  ["he", "he"],
  ["dsr", "dsr"],
  ["remun", "remun"],
  ["enc", "enc"],
  ["prov", "prov"],
  ["nf", "nf"],
  ["vtBruto", "vtG"],
  ["vtDesc", "vtDesc"],
  ["vt", "vt"],
  ["benef", "benef"],
  ["admissoes", "ad"],
  ["desligamentos", "de"],
  ["exames", "exames"],
  ["resc", "resc"],
  ["ferr", "ferr"],
  ["salFam", "sf"],
  ["ferPag", "ferPag"],
  ["sub", "sub"],
  ["rl", "rl"],
  ["total", "tot"],
  ["caixa", "caixa"],
  ["dias", "dTrab"],
  ["horasExtras", "hh"],
  ["valorHoraExtra", "vh"],
  ["horaExtraCheia", "vhCheio"],
];

const CASOS: [string, number][] = P.D.obras.map((o: { nome: string }, j: number) => [o.nome, j]);

describe.each(CASOS)("custo(o, f, i, p) = protótipo · %s", (_nome: string, j: number) => {
  const po = P.D.obras[j];
  const obra = obraDe(P, po);
  const pp = P.pObra(po);
  const params = parametrosDe(pp);
  const mov = P.movimentos(po);
  const n = po.he.length;

  for (const f of ctx.funcoes) {
    if (!(po.q[f.id] ?? []).some((v: number) => v > 0)) continue;
    it(`${f.id}: todos os componentes, ${n} meses`, () => {
      for (let i = 0; i < n; i++) {
        const ref = P.custoFun(po, f.id, i, pp, mov);
        const c = custoFuncaoMes(obra, f, i, params, ctx, {
          admissoes: mov.adm[f.id]![i],
          desligamentos: mov.dem[f.id]![i],
        });
        for (const [nosso, deles] of PARES) {
          const v = c[nosso] as number;
          if (Math.abs(v - ref[deles]) >= CENTAVO)
            expect.fail(`${f.id} mês ${i} ${String(nosso)}: motor ${v} × protótipo ${ref[deles]}`);
        }
        const tiposHe: [keyof CustoMes["heTipo"], string][] = [
          ["util", "a"],
          ["sabado", "sab"],
          ["intervalo", "int"],
          ["feriado", "fer"],
        ];
        for (const [t, k] of tiposHe)
          expect(Math.abs(c.heTipo[t] - (ref.heB[k] ?? 0))).toBeLessThan(CENTAVO);
        for (const [k, v] of Object.entries(ref.adB as Record<string, number>))
          expect(Math.abs(c.adicionais[k as keyof typeof c.adicionais] - v)).toBeLessThan(CENTAVO);
        for (const [k, v] of Object.entries(ref.benB as Record<string, number>))
          expect(Math.abs((c.beneficiosItem[k] ?? 0) - v)).toBeLessThan(CENTAVO);
      }
    });
  }
});
