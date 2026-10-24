/**
 * Situação da obra (M11): em andamento recebe a folha mês a mês; concluída tem o período fechado
 * e serve de referência para projeções.
 */
import { mesAno, numero } from "@ito/formato";
import { anoMes } from "@ito/motor";
import { inicioDe } from "./obraDoBanco";

export type Situacao = "andamento" | "concluida";

export const emAndamento = (o: { situacao: Situacao }) => o.situacao === "andamento";

/** Período da obra: "mar/25 – out/26"; em andamento sem mês lançado, "a partir de jan/26". */
export function textoPeriodo(o: { inicio: string; meses: number }): string {
  const ini = inicioDe(o.inicio);
  if (o.meses < 1) return `a partir de ${mesAno(ini.ano, ini.mes)}`;
  const fim = anoMes(ini, o.meses - 1);
  return `${mesAno(ini.ano, ini.mes)} – ${mesAno(fim.ano, fim.mes)}`;
}

/** Andamento da obra: "3 de 14 meses previstos", "3 meses lançados", "nenhum mês lançado". */
export function textoAndamento(o: { meses: number; prazo_previsto: number | null }): string {
  if (o.meses < 1) return "nenhum mês lançado";
  if (o.prazo_previsto) return `${numero(o.meses)} de ${numero(o.prazo_previsto)} meses previstos`;
  return o.meses === 1 ? "1 mês lançado" : `${numero(o.meses)} meses lançados`;
}
