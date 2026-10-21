/**
 * Calendário de um mês da obra (SPEC §2): DSR% e dias trabalhados, no modo calendário
 * (feriados nacionais, móveis, da empresa e municipais da obra) ou no modo fixo da tabela.
 */
import { calendarioMes } from "./calendario";
import { anoMes } from "./modelo";
import type { Contexto, Obra, Tabela } from "./modelo";

export interface DiasDoMes {
  /** DSR em % (0–100) */
  dsrPct: number;
  diasTrabalhados: number;
}

export function diasDoMes(
  o: Pick<Obra, "inicio" | "feriadosMunicipais">,
  mesIdx: number,
  t: Tabela,
  ctx: Pick<Contexto, "calendario">,
): DiasDoMes {
  if (t.modoDias === "fixo") return { dsrPct: t.dsrFixoPct, diasTrabalhados: t.diasFixos };
  const { ano, mes } = anoMes(o.inicio, mesIdx);
  const c = calendarioMes(ano, mes, ctx.calendario, o.feriadosMunicipais ?? []);
  return { dsrPct: c.dsrPct, diasTrabalhados: c.seg + (t.sabadoTrabalhado ? c.sab : 0) };
}
