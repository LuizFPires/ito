/** Contas das abas do detalhe da obra que não saem prontas do motor (testadas à parte). */
import type { ResultadoObra } from "@ito/motor";
import type { FuncaoInfo } from "./comum";

export const CONTA_VT = "04.02.07";
export const CONTA_EXAMES = "04.01.03";

export interface LinhaConta {
  conta: string;
  nome: string;
  v: number[];
}

/**
 * Apropriação por conta (protótipo `apropriacao`): cada função na conta dela (salário,
 * adicionais, HE, DSR, encargos, provisões, rescisões, tributos, risco/lucro, ferramentas); VT,
 * benefícios e exames nas contas próprias. A soma das contas é o custo total (competência).
 */
export function apropriacaoPorConta(
  r: ResultadoObra,
  fun: (id: string) => FuncaoInfo,
  beneficios: readonly { id: string; nome: string; conta_pc: string }[],
): LinhaConta[] {
  const n = r.n;
  const linhas = new Map<string, LinhaConta>();
  const add = (conta: string, nome: string, i: number, v: number) => {
    const l = linhas.get(conta) ?? { conta, nome, v: Array<number>(n).fill(0) };
    l.v[i]! += v;
    linhas.set(conta, l);
  };
  const porBen = new Map(beneficios.map((b) => [b.id, b]));
  // a conta leva os nomes das funções que caem nela (não só o da primeira)
  const nomeConta = (conta: string) =>
    r.funcoes
      .filter((k) => fun(k).conta === conta)
      .map((k) => fun(k).nome)
      .join(", ");
  for (const k of r.funcoes)
    r.porFuncao[k]!.forEach((c, i) => {
      const fn = fun(k);
      add(
        fn.conta,
        nomeConta(fn.conta),
        i,
        c.salv + c.extras + c.he + c.dsr + c.enc + c.prov + c.resc + c.nf + c.rl + c.ferr,
      );
      add(CONTA_VT, "Vale-transporte", i, c.vt);
      for (const [b, v] of Object.entries(c.beneficiosItem)) {
        const x = porBen.get(b);
        add(x?.conta_pc || "—", x?.nome ?? b, i, v);
      }
      add(CONTA_EXAMES, "Exames admissionais, periódicos e demissionais", i, c.exames);
    });
  return [...linhas.values()].sort((a, b) => a.conta.localeCompare(b.conta));
}
