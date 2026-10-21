/**
 * Cálculo da obra inteira: custo por função e mês, caixa com adiantamento (SPEC §4.5) e
 * agregações por mês, grupo de função e total.
 */
import { custoFuncaoMes, premissasDe } from "./custo";
import type { CustoMes } from "./custo";
import type { Contexto, GrupoFuncao, Obra, ParametrosObra } from "./modelo";
import { nMeses } from "./modelo";
import { movimentos } from "./movimentos";
import type { Movimentos } from "./movimentos";

/** Campos numéricos somáveis de um custo (para totais do mês e da obra). */
export const CAMPOS_SOMAVEIS = [
  "x",
  "xa",
  "pres",
  "bruto",
  "faltasH",
  "faltasD",
  "faltas",
  "salv",
  "bolsa",
  "extras",
  "horasExtras",
  "he",
  "dsr",
  "remun",
  "enc",
  "prov",
  "nf",
  "vtBruto",
  "vtDesc",
  "vt",
  "benef",
  "admissoes",
  "desligamentos",
  "exames",
  "resc",
  "ferr",
  "salFam",
  "ferPag",
  "sub",
  "rl",
  "total",
  "caixa",
  "dias",
  "licD",
  "ferD",
] as const;
export type CampoSomavel = (typeof CAMPOS_SOMAVEIS)[number];

export type Soma = Record<CampoSomavel, number> & {
  adicionais: Record<string, number>;
  heTipo: Record<string, number>;
  beneficiosItem: Record<string, number>;
  examesTipo: Record<string, number>;
  /** saldo da folha que vai para o caixa do mês seguinte (adiantamento) */
  saldoFolha: number;
};

export interface CustoMesObra extends CustoMes {
  saldoFolha: number;
}

export interface ResultadoObra {
  n: number;
  movimentos: Movimentos;
  /** funções com efetivo na obra */
  funcoes: string[];
  porFuncao: Record<string, CustoMesObra[]>;
  porMes: Soma[];
  porGrupo: Record<GrupoFuncao, number>;
  total: Soma;
}

const somaVazia = (): Soma => {
  const s = Object.fromEntries(CAMPOS_SOMAVEIS.map((k) => [k, 0])) as Record<CampoSomavel, number>;
  return { ...s, adicionais: {}, heTipo: {}, beneficiosItem: {}, examesTipo: {}, saldoFolha: 0 };
};

function acumular(alvo: Record<string, number>, de: Record<string, number>) {
  for (const [k, v] of Object.entries(de)) alvo[k] = (alvo[k] ?? 0) + v;
}

export function somar(lista: readonly (CustoMesObra | Soma)[]): Soma {
  const r = somaVazia();
  for (const c of lista) {
    for (const k of CAMPOS_SOMAVEIS) r[k] += c[k];
    acumular(r.adicionais, c.adicionais as unknown as Record<string, number>);
    acumular(r.heTipo, c.heTipo);
    acumular(r.beneficiosItem, c.beneficiosItem);
    acumular(r.examesTipo, c.examesTipo);
    r.saldoFolha += c.saldoFolha;
  }
  return r;
}

export interface OpcoesObra {
  /** movimentos já conhecidos (histórico real, vindos da folha); sem eles, §4.6 */
  movimentos?: Movimentos;
}

export function calcularObra(
  o: Obra,
  p: ParametrosObra,
  ctx: Contexto,
  op: OpcoesObra = {},
): ResultadoObra {
  const n = nMeses(o);
  const todas = ctx.funcoes.map((f) => f.id);
  const mov = op.movimentos ?? movimentos(o, todas);
  const comEfetivo = ctx.funcoes.filter((f) => (o.equivalente[f.id] ?? []).some((v) => v > 0));
  const pr = premissasDe(o);

  const porFuncao: Record<string, CustoMesObra[]> = {};
  for (const f of comEfetivo) {
    const linha: CustoMesObra[] = Array.from({ length: n }, (_, i) => ({
      ...custoFuncaoMes(o, f, i, p, ctx, {
        admissoes: mov.admissoes[f.id]?.[i] ?? 0,
        desligamentos: mov.desligamentos[f.id]?.[i] ?? 0,
      }),
      saldoFolha: 0,
    }));
    // §4.5 caixa: adiantamento no próprio mês; o saldo da folha sai no mês seguinte
    if (pr.adiantamento) {
      const ap = pr.adiantamentoPct / 100;
      const remun = linha.map((c) => c.remun);
      linha.forEach((c, i) => {
        const sai = i < n - 1 ? remun[i]! * (1 - ap) : 0;
        const entra = i ? remun[i - 1]! * (1 - ap) : 0;
        c.caixa += entra - sai;
        c.saldoFolha = sai;
      });
    }
    porFuncao[f.id] = linha;
  }

  const porMes = Array.from({ length: n }, (_, i) =>
    somar(comEfetivo.map((f) => porFuncao[f.id]![i]!)),
  );
  const porGrupo: Record<GrupoFuncao, number> = { direta: 0, indireta: 0, adm: 0 };
  for (const f of comEfetivo) for (const c of porFuncao[f.id]!) porGrupo[f.grupo] += c.total;

  return {
    n,
    movimentos: mov,
    funcoes: comEfetivo.map((f) => f.id),
    porFuncao,
    porMes,
    porGrupo,
    total: somar(porMes),
  };
}
