/**
 * Golden SPEC §8 — conferência da folha: diferença R$ 0,00 em todas as obras de exemplo
 * (regra 4). E o gerador de rubricas igual ao do protótipo.
 */
import { describe, expect, it } from "vitest";
import { calcularObra } from "./obra";
import { carregarPrototipo, contextoDe, obraDe, parametrosDe } from "./prototipo.harness";
import { conferirFolha, gerarRubricasMes } from "./rubricas";
import type { RubricaDicionario } from "./rubricas";

const P = carregarPrototipo();
const ctx = contextoDe(P);
/* eslint-disable @typescript-eslint/no-explicit-any -- dicionário do protótipo */
const DIC: RubricaDicionario[] = P.D.rubricas.map((r: any) => ({
  codigo: r.cod,
  tipo: r.tipo,
  componente: r.comp,
}));
const CASOS: [string, number][] = P.D.obras.map((o: { nome: string }, j: number) => [o.nome, j]);

describe.each(CASOS)("folha · %s", (_nome: string, j: number) => {
  const po = P.D.obras[j];
  const r = calcularObra(obraDe(P, po), parametrosDe(P.pObra(po)), ctx);
  const ref = P.calc(po, P.pObra(po));

  it("conferência rubricas × custo fecha em R$ 0,00 em todos os meses", () => {
    const conf = conferirFolha(r.porMes, DIC);
    for (const m of conf) {
      expect(Math.abs(m.diferenca)).toBeLessThan(0.005);
      expect(m.confere).toBe(true);
    }
  });

  it("valor de cada rubrica igual ao gerador do protótipo", () => {
    for (let i = 0; i < r.n; i++) {
      for (const { codigo, valor } of gerarRubricasMes(r.porMes[i]!, DIC)) {
        const deles = P.RUBGEN[codigo]!(ref.M[i]);
        if (Math.abs(valor - deles) >= 0.005)
          expect.fail(`rubrica ${codigo} mês ${i}: motor ${valor} × protótipo ${deles}`);
      }
    }
  });
});

describe("conferência acusa diferença quando o custo não fecha", () => {
  it("rubrica de salário faltando vira 'Diferença'", () => {
    const po = P.D.obras[0];
    const r = calcularObra(obraDe(P, po), parametrosDe(P.pObra(po)), ctx);
    const semSalario = DIC.filter((x) => x.codigo !== 1);
    const conf = conferirFolha(r.porMes, semSalario);
    expect(conf.some((m) => !m.confere)).toBe(true);
  });
});
