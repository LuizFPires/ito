/** Contas das abas do detalhe da obra que não saem prontas do motor (testadas à parte). */
import type { Obra, ResultadoObra } from "@ito/motor";
import { custoFuncaoMes } from "@ito/motor";
import { parametrosDe } from "../../lib/obraDoBanco";
import type { DadosAba, FuncaoInfo } from "./comum";

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

/**
 * Absenteísmo médio da obra ponderado pelo efetivo de cada mês (protótipo `absMedio`), como a
 * projeção usa quando a obra é referência.
 */
export function absenteismoMedio(o: Pick<Obra, "equivalente" | "absenteismoPct">): number {
  const n = o.absenteismoPct.length;
  const tot = Array.from({ length: n }, (_, i) =>
    Object.values(o.equivalente).reduce((s, v) => s + (v[i] ?? 0), 0),
  );
  const pm = tot.reduce((a, b) => a + b, 0);
  return pm ? tot.reduce((s, x, i) => s + x * (o.absenteismoPct[i] ?? 0), 0) / pm : 0;
}

/** Custo das pessoas realocadas no período, com os preços e premissas da obra (época). */
export function custoRealocacao(
  dados: Pick<DadosAba, "d" | "ctx" | "obra" | "rotulos">,
  x: { funcao_id: string; mes_ini: number; mes_fim: number; qtd: number },
): number {
  const fn = dados.ctx.ctx.funcoes.find((y) => y.id === x.funcao_id);
  if (!fn) return 0;
  const p = parametrosDe(dados.d, dados.ctx.tabelas, dados.ctx.vigente, "epoca");
  let t = 0;
  for (let i = x.mes_ini; i <= Math.min(x.mes_fim, dados.rotulos.length - 1); i++)
    t += custoFuncaoMes(dados.obra, fn, i, p, dados.ctx.ctx, { x: x.qtd }).total;
  return t;
}

export const NOME_CONSTRUTORA = { classica: "Clássica", ampla: "Ampla" } as const;
export type Construtora = keyof typeof NOME_CONSTRUTORA;

export interface LinhaConstrutora {
  construtora: Construtora;
  /** pessoa-mês por mês (sem a MDO realocada) */
  pm: number[];
  /** pessoas diferentes por mês */
  cabecas: number[];
  /** remuneração na folha (rubricas que entram no custo, descontos negativos) */
  remun: number[];
}

/**
 * Efetivo e folha por construtora (decisão M9: Ampla e Clássica na mesma obra). Lê os lançamentos
 * por matrícula, que só quem carrega vê.
 */
export function porConstrutora(
  lancamentos: readonly {
    mes_idx: number;
    matricula: string;
    funcao_id: string;
    construtora: string;
    equivalente: number | string;
    realocada_para: string | null;
  }[],
  rubricas: readonly {
    mes_idx: number;
    matricula: string;
    funcao_id: string;
    construtora: string;
    rubrica_codigo: number;
    valor: number | string;
  }[],
  noCusto: ReadonlyMap<number, string>,
  n: number,
): LinhaConstrutora[] {
  const linhas = new Map<Construtora, LinhaConstrutora & { vistos: Set<string>[] }>();
  const obter = (c: string) => {
    const k = (c === "ampla" ? "ampla" : "classica") as Construtora;
    let l = linhas.get(k);
    if (!l) {
      l = {
        construtora: k,
        pm: Array(n).fill(0),
        cabecas: Array(n).fill(0),
        remun: Array(n).fill(0),
        vistos: Array.from({ length: n }, () => new Set<string>()),
      };
      linhas.set(k, l);
    }
    return l;
  };
  const realocado = new Set<string>();
  for (const x of lancamentos) {
    if (x.realocada_para) {
      realocado.add(`${x.mes_idx}|${x.matricula}|${x.funcao_id}|${x.construtora}`);
      continue;
    }
    const l = obter(x.construtora);
    const eq = Number(x.equivalente);
    l.pm[x.mes_idx]! += eq;
    if (eq > 0 && !l.vistos[x.mes_idx]!.has(x.matricula)) {
      l.vistos[x.mes_idx]!.add(x.matricula);
      l.cabecas[x.mes_idx]! += 1;
    }
  }
  for (const r of rubricas) {
    if (realocado.has(`${r.mes_idx}|${r.matricula}|${r.funcao_id}|${r.construtora}`)) continue;
    const tipo = noCusto.get(r.rubrica_codigo);
    if (!tipo) continue;
    const v = Number(r.valor);
    obter(r.construtora).remun[r.mes_idx]! += tipo === "desconto" ? -Math.abs(v) : v;
  }
  return [...linhas.values()]
    .sort((a, b) => a.construtora.localeCompare(b.construtora) * -1)
    .map(({ vistos: _v, ...l }) => l);
}
