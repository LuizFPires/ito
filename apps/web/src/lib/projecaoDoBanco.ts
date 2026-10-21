/**
 * Projeção (M7): linha do banco ↔ entradas da tela ↔ entrada do motor. Quantidades vêm das obras
 * de referência; preços, da cidade da obra (CCT, VT, ISS, feriados) e da tabela vigente, com o
 * reajuste na data-base (regra 1, SPEC §3 e §5).
 */
import type {
  Cenario,
  Contexto,
  CctPrecos,
  EntradaProjecao,
  InicioObra,
  Origem,
  ParametrosObra,
  Premissas,
  Regime,
  Reajuste,
  ResultadoProjecao,
  Tabela,
  TipoHe,
} from "@ito/motor";
import {
  aplicarReajustes,
  cenariosDeOrigem,
  projetar,
  reajustesDaProjecao,
  tabelaDaCidade,
} from "@ito/motor";
import type { ObraBanco } from "./obraDoBanco";
import { inicioDe, obraDoBanco } from "./obraDoBanco";
import type { Database } from "./tipos-banco";

type T = Database["public"]["Tables"];
export type LinhaProjecao = T["projecoes"]["Row"];
export type Situacao = Database["public"]["Enums"]["situacao_projecao"];

export const NOME_SITUACAO: Record<Situacao, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  aprovada: "Aprovada",
};

/** Entradas da projeção como a tela edita (camelCase, percentuais de 0 a 100). */
export interface Entradas {
  nome: string;
  cliente: string;
  tipologia: string;
  cidadeId: string | null;
  cidadeOrigemId: string | null;
  inicio: InicioObra;
  prazo: number;
  area: number;
  referencias: string[];
  estatistica: "media" | "mediana";
  ajustes: Record<string, number>;
  quantidadesManuais: Record<string, number[]> | null;
  heMedia: number | null;
  absenteismoPct: number | null;
  rotatividadePct: number | null;
  licencaPorPm: number | null;
  feriasPorPm: number | null;
  heMix: Record<TipoHe, number> | null;
  premissas: Partial<Premissas>;
  regime: Record<string, Regime>;
  origem: Record<string, Origem>;
  reajuste: { mesIdx: number; pct: number } | null;
}

export function entradasVazias(hoje = new Date()): Entradas {
  return {
    nome: "",
    cliente: "",
    tipologia: "",
    cidadeId: null,
    cidadeOrigemId: null,
    inicio: { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 },
    prazo: 12,
    area: 0,
    referencias: [],
    estatistica: "media",
    ajustes: {},
    quantidadesManuais: null,
    heMedia: null,
    absenteismoPct: null,
    rotatividadePct: null,
    licencaPorPm: null,
    feriasPorPm: null,
    heMix: null,
    premissas: {},
    regime: {},
    origem: {},
    reajuste: null,
  };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function entradasDaLinha(p: LinhaProjecao): Entradas {
  return {
    nome: p.nome,
    cliente: p.cliente,
    tipologia: p.tipologia,
    cidadeId: p.cidade_id,
    cidadeOrigemId: p.cidade_origem_id,
    inicio: inicioDe(p.inicio),
    prazo: p.prazo_meses,
    area: Number(p.area_m2),
    referencias: p.referencias,
    estatistica: p.estatistica === "mediana" ? "mediana" : "media",
    ajustes: (p.ajustes ?? {}) as Record<string, number>,
    quantidadesManuais: (p.quantidades_manuais as Record<string, number[]> | null) ?? null,
    heMedia: num(p.he_media),
    absenteismoPct: num(p.absenteismo_pct),
    rotatividadePct: num(p.rotatividade_pct),
    licencaPorPm: num(p.licenca_por_pm),
    feriasPorPm: num(p.ferias_por_pm),
    heMix: (p.he_mix as Record<TipoHe, number> | null) ?? null,
    premissas: (p.premissas ?? {}) as Partial<Premissas>,
    regime: (p.regime ?? {}) as Record<string, Regime>,
    origem: (p.origem ?? {}) as Record<string, Origem>,
    reajuste:
      p.reajuste_mes === null || p.reajuste_pct === null
        ? null
        : { mesIdx: p.reajuste_mes, pct: Number(p.reajuste_pct) },
  };
}

export function linhaDasEntradas(e: Entradas): T["projecoes"]["Insert"] {
  return {
    nome: e.nome.trim(),
    cliente: e.cliente.trim(),
    tipologia: e.tipologia,
    cidade_id: e.cidadeId,
    cidade_origem_id: e.cidadeOrigemId,
    inicio: `${e.inicio.ano}-${String(e.inicio.mes).padStart(2, "0")}-01`,
    prazo_meses: e.prazo,
    area_m2: e.area,
    referencias: e.referencias,
    estatistica: e.estatistica,
    ajustes: e.ajustes,
    quantidades_manuais: e.quantidadesManuais,
    he_media: e.heMedia,
    absenteismo_pct: e.absenteismoPct,
    rotatividade_pct: e.rotatividadePct,
    licenca_por_pm: e.licencaPorPm,
    ferias_por_pm: e.feriasPorPm,
    he_mix: e.heMix,
    premissas: e.premissas as never,
    regime: e.regime,
    origem: e.origem,
    reajuste_mes: e.reajuste?.mesIdx ?? null,
    reajuste_pct: e.reajuste?.pct ?? null,
  };
}

/** Cidade com o que a projeção precisa (VT, ISS, feriados, CCT). */
export interface CidadeComPrecos {
  id: string;
  nome: string;
  cctId: string;
  tarifaLocal: number;
  conducoes: number;
  issPct: number;
  passagens: Record<string, number>;
  feriados: { dia: number; mes: number; nome: string }[];
}

export interface Precos {
  vigente: Tabela;
  cidade: CidadeComPrecos | null;
  cidadeOrigem: CidadeComPrecos | null;
  cct: CctPrecos | null;
}

export interface Calculo {
  parametros: ParametrosObra;
  reajustes: Reajuste[];
  entrada: EntradaProjecao;
  r: ResultadoProjecao | null;
}

/** Monta a entrada do motor e calcula. Referências que sumiram da base ficam de fora. */
export function calcularProjecao(
  e: Entradas,
  referencias: readonly ObraBanco[],
  precos: Precos,
  ctx: Contexto,
): Calculo {
  const { vigente, cidade, cidadeOrigem, cct } = precos;
  const base = cidade && cct ? tabelaDaCidade(vigente, cct, cidade) : vigente;
  const reajustes = reajustesDaProjecao(e.inicio, e.prazo, e.reajuste, cct);
  const parametros = aplicarReajustes(base, e.prazo, reajustes);
  const entrada: EntradaProjecao = {
    inicio: e.inicio,
    prazo: e.prazo,
    area: e.area,
    referencias: referencias.map((b) => obraDoBanco(b).obra),
    estatistica: e.estatistica,
    ajustesPct: e.ajustes,
    quantidadesManuais: e.quantidadesManuais,
    heMedia: e.heMedia,
    absenteismoPct: e.absenteismoPct,
    rotatividadePct: e.rotatividadePct,
    licencaPorPm: e.licencaPorPm,
    feriasPorPm: e.feriasPorPm,
    heMixPct: e.heMix,
    premissas: e.premissas,
    regime: e.regime,
    origem: e.origem,
    cidade,
    cidadeOrigem,
    vtDiariaReferencia: vigente.vtDiaria,
  };
  let r: ResultadoProjecao | null;
  try {
    r = projetar(entrada, parametros, ctx);
  } catch {
    r = null;
  }
  return { parametros, reajustes, entrada, r };
}

export function cenarios(c: Calculo, ctx: Contexto): Cenario[] {
  try {
    return c.r ? cenariosDeOrigem(c.entrada, c.parametros, ctx) : [];
  } catch {
    return [];
  }
}

/** Resumo gravado junto com a projeção, para a lista. */
export const resumoDaProjecao = (c: Calculo, vigente: number) =>
  c.r
    ? {
        total: Math.round(c.r.total * 100) / 100,
        pico: c.r.pico,
        pessoa_mes: Math.round(c.r.pessoaMes * 100) / 100,
        vigente,
      }
    : {};

/**
 * "5 mais parecidas" (decisão M7): mesma tipologia primeiro, depois área e prazo mais próximos
 * (distância em escala logarítmica, para 2.000 × 4.000 m² pesar como 4.000 × 8.000 m²).
 */
export function maisParecidas<
  O extends { id: string; tipologia: string; area_m2: number; meses: number },
>(e: Pick<Entradas, "tipologia" | "area" | "prazo">, obras: readonly O[], n = 5): O[] {
  const d = (o: O) =>
    (e.tipologia && o.tipologia === e.tipologia ? 0 : 10) +
    Math.abs(Math.log(Math.max(1, o.area_m2) / Math.max(1, e.area))) +
    Math.abs(Math.log(Math.max(1, o.meses) / Math.max(1, e.prazo)));
  return [...obras].sort((a, b) => d(a) - d(b)).slice(0, n);
}
