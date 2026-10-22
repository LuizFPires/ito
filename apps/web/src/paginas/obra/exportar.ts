/**
 * Tabelas da obra para exportar (.xlsx) e copiar para o Excel (M8): efetivo, custo por função e
 * por componente, rubricas e apropriação. Mesmos números das abas.
 */
import type { CustoMes, Obra, ResultadoObra, Soma } from "@ito/motor";
import { somar } from "@ito/motor";
import type { Coluna, Tabela } from "../../lib/planilha";
import type { LinhaConta } from "./calculos";
import type { DadosAba, FuncaoInfo } from "./comum";
import { COMPONENTES, NOME_GRUPO_F, rotulosDe, soma } from "./comum";
import { numero } from "@ito/formato";

/** Cabeçalho das abas exportadas: obra, cliente, cidade, área e período. */
export function tituloObra(dados: Pick<DadosAba, "d" | "obra" | "cidade">): string[] {
  const o = dados.d.obra;
  const m = rotulosDe(dados.obra, "data");
  return [
    o.nome,
    [o.cliente || "Sem cliente", dados.cidade, `${numero(Number(o.area_m2))} m²`]
      .filter(Boolean)
      .join(" · "),
    `Período ${m[0] ?? ""} a ${m[m.length - 1] ?? ""} · CCT da época ${o.data_base}`,
  ];
}

/** Título da visão de custo (época ou atualizado, competência ou caixa). */
export const tituloVisao = (dados: Pick<DadosAba, "vista" | "d" | "ctx">) =>
  `${dados.vista.visao === "epoca" ? `Valores da época (CCT ${dados.d.obra.data_base})` : `Atualizado a preços de ${dados.ctx.vigente}`} · ${dados.vista.caixa ? "caixa" : "competência"}`;

const meses = (rotulos: readonly string[], formato: Coluna["formato"]): Coluna[] =>
  rotulos.map((m) => ({ titulo: m, formato }));

export function tabelaEfetivo(
  obra: Obra,
  ids: readonly string[],
  fun: (id: string) => FuncaoInfo,
  rotulos: readonly string[],
  titulo: readonly string[],
  cabecas = false,
): Tabela {
  const v = (k: string) =>
    rotulos.map((_, i) => (cabecas ? obra.cabecas?.[k]?.[i] : obra.equivalente[k]?.[i]) ?? 0);
  return {
    aba: cabecas ? "Cabeças" : "Efetivo",
    titulo: [
      ...titulo,
      cabecas
        ? "Cabeças (pessoas diferentes no mês)"
        : "Pessoa-mês equivalente (efetivo pela fração de dias no mês)",
    ],
    colunas: [
      { titulo: "Função", formato: "texto", largura: 26 },
      { titulo: "Grupo", formato: "texto" },
      ...meses(rotulos, "pm"),
      { titulo: "Pessoa-mês", formato: "pm" },
    ],
    linhas: [
      ...ids.map((k) => [fun(k).nome, NOME_GRUPO_F[fun(k).grupo], ...v(k), soma(v(k))]),
      ["Total", "", ...rotulos.map((_, i) => soma(ids.map((k) => v(k)[i]!))), soma(ids.flatMap(v))],
    ],
    total: true,
  };
}

export function tabelaCustoFuncao(
  r: ResultadoObra,
  ids: readonly string[],
  fun: (id: string) => FuncaoInfo,
  rotulos: readonly string[],
  V: (c: CustoMes | Soma) => number,
  titulo: readonly string[],
): Tabela {
  const linha = (k: string) => r.porFuncao[k]!.map(V);
  const M = rotulos.map((_, i) => somar(ids.map((k) => r.porFuncao[k]![i]!)));
  return {
    aba: "Custo por função",
    titulo,
    colunas: [
      { titulo: "Função", formato: "texto", largura: 26 },
      { titulo: "Grupo", formato: "texto" },
      ...meses(rotulos, "moeda"),
      { titulo: "Total", formato: "moeda", largura: 16 },
    ],
    linhas: [
      ...ids.map((k) => [fun(k).nome, NOME_GRUPO_F[fun(k).grupo], ...linha(k), soma(linha(k))]),
      ["Total do mês", "", ...M.map(V), soma(M.map(V))],
    ],
    total: true,
  };
}

/** Por componente: na visão caixa as provisões ficam de fora (são pagas depois). */
export function tabelaCustoComponente(
  r: ResultadoObra,
  ids: readonly string[],
  rotulos: readonly string[],
  V: (c: CustoMes | Soma) => number,
  caixa: boolean,
  titulo: readonly string[],
): Tabela {
  const M = rotulos.map((_, i) => somar(ids.map((k) => r.porFuncao[k]![i]!)));
  return {
    aba: "Custo por componente",
    titulo,
    colunas: [
      { titulo: "Componente", formato: "texto", largura: 40 },
      ...meses(rotulos, "moeda"),
      { titulo: "Total", formato: "moeda", largura: 16 },
    ],
    linhas: [
      ...COMPONENTES.filter((c) => !(caixa && c.k === "prov")).map((c) => [
        c.n,
        ...M.map((m) => m[c.k]),
        soma(M.map((m) => m[c.k])),
      ]),
      ["Total do mês", ...M.map(V), soma(M.map(V))],
    ],
    total: true,
  };
}

export function tabelaApropriacao(
  linhas: readonly LinhaConta[],
  rotulos: readonly string[],
  titulo: readonly string[],
): Tabela {
  const tot = rotulos.map((_, i) => soma(linhas.map((l) => l.v[i]!)));
  return {
    aba: "Apropriação",
    titulo: [...titulo, "Valores da época, competência"],
    colunas: [
      { titulo: "Conta", formato: "texto", largura: 12 },
      { titulo: "Descrição", formato: "texto", largura: 36 },
      ...meses(rotulos, "moeda"),
      { titulo: "Total", formato: "moeda", largura: 16 },
    ],
    linhas: [
      ...linhas.map((l) => [l.conta, l.nome, ...l.v, soma(l.v)]),
      ["Total", "", ...tot, soma(tot)],
    ],
    total: true,
  };
}

export interface RubricaCad {
  codigo: number;
  nome: string;
  tipo: string;
}

/**
 * Rubricas somadas por código e mês, sem a MDO realocada (só os agregados, sem matrícula).
 * Descontos com sinal negativo (a folha pode trazê-los positivos: o tipo decide).
 */
export function rubricasPorMes(
  lancamentos: readonly {
    mes_idx: number;
    matricula: string;
    funcao_id: string;
    realocada_para: string | null;
  }[],
  rubricas: readonly {
    mes_idx: number;
    matricula: string;
    funcao_id: string;
    rubrica_codigo: number;
    valor: number | string;
  }[],
  n: number,
): Map<number, number[]> {
  const realocado = new Set(
    lancamentos
      .filter((l) => l.realocada_para)
      .map((l) => `${l.mes_idx}|${l.matricula}|${l.funcao_id}`),
  );
  const porCodigo = new Map<number, number[]>();
  for (const x of rubricas) {
    if (realocado.has(`${x.mes_idx}|${x.matricula}|${x.funcao_id}`)) continue;
    if (!porCodigo.has(x.rubrica_codigo)) porCodigo.set(x.rubrica_codigo, Array(n).fill(0));
    porCodigo.get(x.rubrica_codigo)![x.mes_idx]! += Number(x.valor);
  }
  return porCodigo;
}

export function tabelaRubricas(
  porCodigo: ReadonlyMap<number, readonly number[]>,
  cad: ReadonlyMap<number, RubricaCad>,
  rotulos: readonly string[],
  titulo: readonly string[],
): Tabela {
  const codigos = [...porCodigo.keys()]
    .filter((c) => porCodigo.get(c)!.some((v) => Math.abs(v) > 0.5))
    .sort((a, b) => a - b);
  const serie = (c: number) =>
    porCodigo.get(c)!.map((v) => (cad.get(c)?.tipo === "desconto" ? -Math.abs(v) : v));
  const somaTipo = (tipo: string) =>
    rotulos.map((_, i) =>
      soma(codigos.filter((c) => cad.get(c)?.tipo === tipo).map((c) => serie(c)[i]!)),
    );
  const prov = somaTipo("provento");
  const desc = somaTipo("desconto");
  const liq = prov.map((v, i) => v + desc[i]!);
  return {
    aba: "Rubricas",
    titulo: [...titulo, "Folha por rubrica, sem matrícula e sem a MDO realocada"],
    colunas: [
      { titulo: "Código", formato: "texto", largura: 9 },
      { titulo: "Rubrica", formato: "texto", largura: 32 },
      { titulo: "Tipo", formato: "texto", largura: 12 },
      ...meses(rotulos, "moeda"),
      { titulo: "Total", formato: "moeda", largura: 16 },
    ],
    linhas: [
      ...codigos.map((c) => [
        String(c),
        cad.get(c)?.nome ?? "—",
        cad.get(c)?.tipo ?? "",
        ...serie(c),
        soma(serie(c)),
      ]),
      ["", "Proventos", "", ...prov, soma(prov)],
      ["", "Descontos", "", ...desc, soma(desc)],
      ["", "Líquido da folha", "", ...liq, soma(liq)],
    ],
    total: true,
  };
}
