/**
 * Obra da base histórica (linhas do banco) → entrada do motor, e o resumo da lista (M5).
 * Época = tabela da data-base da obra, com as trocas no meio dela; atualizado = tabela vigente
 * (SPEC §3).
 */
import type {
  Contexto,
  Movimentos,
  Obra,
  ParametrosObra,
  Regime,
  ResultadoObra,
  Tabela,
  TipoHe,
} from "@ito/motor";
import { calcularObra, parametrosEpoca } from "@ito/motor";
import type { Database } from "./tipos-banco";

type T = Database["public"]["Tables"];
export type LinhaObra = T["obras"]["Row"];
export type LinhaCompetencia = T["competencias"]["Row"];
export type LinhaEfetivo = T["efetivo_mes"]["Row"];

export interface ObraBanco {
  obra: LinhaObra;
  competencias: readonly LinhaCompetencia[];
  efetivo: readonly LinhaEfetivo[];
  regime: readonly { funcao_id: string; regime: Regime }[];
  trocas: readonly { mes_idx: number; data_base: number; motivo: string }[];
  feriados: readonly { data: string; nome: string }[];
}

/** Versão do cálculo do resumo: muda quando o motor ou o resumo mudam (força recalcular). */
export const VERSAO_RESUMO = 1;

export const inicioDe = (iso: string) => ({
  ano: Number(iso.slice(0, 4)),
  mes: Number(iso.slice(5, 7)),
});

export function obraDoBanco(b: ObraBanco): { obra: Obra; movimentos: Movimentos } {
  const o = b.obra;
  const n = o.meses;
  const serie = () => Array<number>(n).fill(0);
  const equivalente: Record<string, number[]> = {};
  const cabecas: Record<string, number[]> = {};
  const admissoes: Record<string, number[]> = {};
  const desligamentos: Record<string, number[]> = {};
  for (const e of b.efetivo) {
    const f = e.funcao_id;
    if (!equivalente[f]) {
      equivalente[f] = serie();
      cabecas[f] = serie();
      admissoes[f] = serie();
      desligamentos[f] = serie();
    }
    if (e.mes_idx >= n) continue;
    equivalente[f]![e.mes_idx] = Number(e.equivalente);
    cabecas[f]![e.mes_idx] = e.cabecas;
    admissoes[f]![e.mes_idx] = e.admissoes;
    desligamentos[f]![e.mes_idx] = e.desligamentos;
  }
  const porMes = <K extends keyof LinhaCompetencia>(k: K) => {
    const s = serie();
    for (const c of b.competencias) if (c.mes_idx < n) s[c.mes_idx] = Number(c[k] ?? 0);
    return s;
  };
  const heMixPct: Record<TipoHe, number> = {
    util: Number(o.he_mix_util),
    sabado: Number(o.he_mix_sabado),
    intervalo: Number(o.he_mix_intervalo),
    feriado: Number(o.he_mix_feriado),
  };
  return {
    obra: {
      id: o.id,
      inicio: inicioDe(o.inicio),
      meses: n,
      area: Number(o.area_m2),
      equivalente,
      cabecas,
      heMedia: porMes("he_media"),
      absenteismoPct: porMes("absenteismo_pct"),
      licencaPessoaDias: porMes("licenca_pessoa_dias"),
      feriasPessoaDias: porMes("ferias_pessoa_dias"),
      rotatividadePct: Number(o.rotatividade_pct),
      heMixPct,
      regime: Object.fromEntries(b.regime.map((r) => [r.funcao_id, r.regime])),
      premissas: {
        gratPremiosPct: Number(o.grat_premios_pct),
        transfPct: Number(o.transf_pct),
        funcoesTransferidas: o.funcoes_transferidas,
        riscoPct: Number(o.risco_pct),
        lucroPct: Number(o.lucro_pct),
        tribLucroPct: Number(o.trib_lucro_pct),
        provisionar: o.provisionar,
        adiantamento: o.adiantamento,
        adiantamentoPct: Number(o.adiantamento_pct),
      },
      feriadosMunicipais: b.feriados.map((f) => ({ data: f.data, nome: f.nome })),
    },
    movimentos: { admissoes, desligamentos },
  };
}

export type Visao = "epoca" | "atualizado";

export function parametrosDe(
  b: Pick<ObraBanco, "obra" | "trocas">,
  tabelas: Readonly<Record<number, Tabela>>,
  vigente: number,
  visao: Visao,
): ParametrosObra {
  if (visao === "atualizado") return tabelas[vigente] ?? tabelas[b.obra.data_base]!;
  return parametrosEpoca(
    tabelas,
    b.obra.data_base,
    b.trocas.map((t) => ({ mesIdx: t.mes_idx, dataBase: t.data_base })),
    vigente,
  );
}

export function calcular(
  b: ObraBanco,
  ctx: Contexto,
  tabelas: Readonly<Record<number, Tabela>>,
  vigente: number,
  visao: Visao,
): ResultadoObra {
  const { obra, movimentos } = obraDoBanco(b);
  return calcularObra(obra, parametrosDe(b, tabelas, vigente, visao), ctx, { movimentos });
}

export interface Resumo {
  obra_id: string;
  vigente: number;
  versao: number;
  /** impressão dos parâmetros usados (tabelas, funções, benefícios, calendário) */
  contexto: string;
  /** revisão da obra sobre a qual o resumo foi calculado */
  revisao: number;
  pico: number;
  pessoa_mes: number;
  he_por_pessoa: number;
  custo_epoca: number;
  custo_atual: number;
  histograma: number[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Resumo da lista (como no protótipo): pico, pessoa-mês e HE por pessoa ponderada. */
export function resumoDaObra(
  b: ObraBanco,
  ctx: Contexto,
  tabelas: Readonly<Record<number, Tabela>>,
  vigente: number,
  contexto = impressaoContexto(ctx, tabelas, vigente),
): Resumo {
  const { obra } = obraDoBanco(b);
  const n = b.obra.meses;
  const totais = Array.from({ length: n }, (_, i) =>
    Object.values(obra.equivalente).reduce((s, v) => s + (v[i] ?? 0), 0),
  );
  const pm = totais.reduce((a, b2) => a + b2, 0);
  const he = pm ? totais.reduce((s, x, i) => s + x * (obra.heMedia[i] ?? 0), 0) / pm : 0;
  return {
    obra_id: b.obra.id,
    vigente,
    versao: VERSAO_RESUMO,
    contexto,
    revisao: b.obra.revisao,
    pico: r2(Math.max(0, ...totais)),
    pessoa_mes: r2(pm),
    he_por_pessoa: r2(he),
    custo_epoca: r2(calcular(b, ctx, tabelas, vigente, "epoca").total.total),
    custo_atual: r2(calcular(b, ctx, tabelas, vigente, "atualizado").total.total),
    histograma: totais.map(r2),
  };
}

/** Dias corridos das competências da obra (do 1º dia do início ao último dia do término). */
export function diasDoPeriodo(inicioIso: string, meses: number): number {
  const { ano, mes } = inicioDe(inicioIso);
  const ini = Date.UTC(ano, mes - 1, 1);
  const fim = Date.UTC(ano, mes - 1 + meses, 1);
  return Math.round((fim - ini) / 86_400_000);
}

/**
 * Impressão digital dos parâmetros do cálculo (FNV-1a sobre o JSON): muda quando a controladoria
 * edita salários, encargos, benefícios, funções ou calendário, e o resumo em cache fica velho.
 */
export function impressaoContexto(
  ctx: Contexto,
  tabelas: Readonly<Record<number, Tabela>>,
  vigente: number,
): string {
  const txt = JSON.stringify({ v: VERSAO_RESUMO, vigente, tabelas, ctx });
  let h = 0x811c9dc5;
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}-${txt.length}`;
}
