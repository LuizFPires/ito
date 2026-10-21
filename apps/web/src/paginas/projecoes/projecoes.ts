/**
 * Projeções (PRD §3.4): filtro, ordenação, textos da lista e a tabela que vai para o Excel.
 */
import { mesAno, numero } from "@ito/formato";
import type { InicioObra } from "@ito/motor";
import { anoMes } from "@ito/motor";
import type { ItemProjecao } from "../../dados/projecoes";
import { contemTermos, ordenar } from "../../lib/lista";
import type { Ordem } from "../../lib/lista";
import type { Situacao } from "../../lib/projecaoDoBanco";

export type FiltroSituacao = "todas" | Situacao;
export type ChaveProjecao = "nome" | "area" | "pico" | "total" | "criado";

export const SITUACOES: readonly Situacao[] = ["rascunho", "em_analise", "aprovada"];
export const TOM_SITUACAO = { rascunho: "neutro", em_analise: "ambar", aprovada: "ok" } as const;
export const MAX_COMPARAR_PROJ = 4;

export function filtrarProjecoes(
  lista: readonly ItemProjecao[],
  situacao: FiltroSituacao,
  q: string,
  cidade: (id: string | null) => string,
): ItemProjecao[] {
  return lista.filter(
    (p) =>
      (situacao === "todas" || p.situacao === situacao) &&
      contemTermos(`${p.nome} ${p.cliente} ${p.tipologia} ${cidade(p.cidade_id)}`, q),
  );
}

export function ordenarProjecoes(
  lista: readonly ItemProjecao[],
  ordem: Ordem<ChaveProjecao>,
): ItemProjecao[] {
  return ordenar(lista, ordem, (p, k) => {
    switch (k) {
      case "nome":
        return p.nome;
      case "area":
        return Number(p.area_m2);
      case "pico":
        return p.resumo.pico ?? -1;
      case "total":
        return p.resumo.total ?? -1;
      case "criado":
        return p.criado_em;
    }
  });
}

/** Quantidades informadas valem quando todas as séries têm o prazo (como o motor). */
export function manualValido(m: unknown, prazo: number): m is Record<string, number[]> {
  if (!m || typeof m !== "object") return false;
  const v = Object.values(m as Record<string, unknown>);
  return v.length > 0 && v.every((a) => Array.isArray(a) && a.length === prazo);
}

/** "3 obras · média" ou "quantidades informadas". */
export function descreverBase(p: {
  referencias: readonly string[];
  estatistica: string;
  quantidades_manuais: unknown;
  prazo_meses: number;
}): string {
  if (manualValido(p.quantidades_manuais, p.prazo_meses)) return "quantidades informadas";
  const n = p.referencias.length;
  if (!n) return "sem referências";
  return `${numero(n)} ${n === 1 ? "obra" : "obras"} · ${p.estatistica === "mediana" ? "mediana" : "média"}`;
}

/** Rótulos dos meses do prazo (jan/27…) ou "mês 1…" no eixo relativo. */
export function rotulosMeses(inicio: InicioObra, prazo: number, relativo = false): string[] {
  return Array.from({ length: prazo }, (_, i) => {
    if (relativo) return `mês ${i + 1}`;
    const m = anoMes(inicio, i);
    return mesAno(m.ano, m.mes);
  });
}

/**
 * Texto tabulado para colar no Excel (decisão M7): números no formato BR (1.234,56), que o
 * Excel em português lê como número. Tabulação e quebra de linha no texto viram espaço.
 */
export function textoTabulado(linhas: readonly (readonly (string | number)[])[]): string {
  const cel = (v: string | number) =>
    typeof v === "number" ? numero(v, 2) : v.replace(/[\t\r\n]+/g, " ");
  return linhas.map((l) => l.map(cel).join("\t")).join("\r\n");
}

/** Diferença sobre a referência: "+R$ …" com o sinal e o percentual. */
export function diferenca(v: number, base: number): { valor: number; pct: number | null } {
  return { valor: v - base, pct: base ? (v / base - 1) * 100 : null };
}
