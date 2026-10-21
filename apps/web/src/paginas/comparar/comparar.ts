/**
 * Comparar obras (PRD §3.3), lógica pura: curvas alinhadas por mês relativo ou por % do prazo e
 * indicadores lado a lado, sempre a preços vigentes.
 */
import type { Contexto, ResultadoObra, Tabela } from "@ito/motor";
import { indicadores as indicadoresMotor } from "@ito/motor";
import type { ObraBanco } from "../../lib/obraDoBanco";
import { calcular, diasDoPeriodo, obraDoBanco } from "../../lib/obraDoBanco";
import { absenteismoMedio } from "../obra/calculos";

export const CORES = ["var(--c3)", "var(--c9)", "var(--c5)", "var(--x2)"];
export type Eixo = "mes" | "prazo";
export type Curva = "pessoas" | "custo";

export interface ObraComparada {
  id: string;
  nome: string;
  area: number;
  meses: number;
  dias: number;
  dataBase: number;
  /** pessoa-mês por mês (equivalente) */
  totais: number[];
  r: ResultadoObra;
  ind: {
    pico: number;
    pmPorMil: number;
    indiretaPct: number;
    heMedia: number;
    absenteismoPct: number;
    rotatividadePct: number;
    encargosPct: number;
    beneficiosPct: number;
    custo: number;
    custoM2: number;
    diaPedreiro: number | null;
  };
}

export function compararObra(
  b: ObraBanco,
  ctx: Contexto,
  tabelas: Readonly<Record<number, Tabela>>,
  vigente: number,
): ObraComparada {
  const { obra } = obraDoBanco(b);
  const r = calcular(b, ctx, tabelas, vigente, "atualizado");
  const n = b.obra.meses;
  const totais = Array.from({ length: n }, (_, i) =>
    Object.values(obra.equivalente).reduce((s, v) => s + (v[i] ?? 0), 0),
  );
  const pm = totais.reduce((a, x) => a + x, 0);
  const area = Number(b.obra.area_m2);
  const m = indicadoresMotor(r);
  const ped = r.porFuncao.ped ?? [];
  const diasPed = ped.reduce((s, c) => s + c.dias, 0);
  return {
    id: b.obra.id,
    nome: b.obra.nome,
    area,
    meses: n,
    dias: diasDoPeriodo(b.obra.inicio, n),
    dataBase: b.obra.data_base,
    totais,
    r,
    ind: {
      pico: Math.max(0, ...totais),
      pmPorMil: area ? (pm / area) * 1000 : 0,
      indiretaPct: m.indiretaPct,
      heMedia: pm ? totais.reduce((s, x, i) => s + x * (obra.heMedia[i] ?? 0), 0) / pm : 0,
      absenteismoPct: absenteismoMedio(obra),
      rotatividadePct: obra.rotatividadePct,
      encargosPct: m.encargosPct,
      beneficiosPct: m.beneficiosPct,
      custo: r.total.total,
      custoM2: area ? r.total.total / area : 0,
      diaPedreiro: diasPed ? ped.reduce((s, c) => s + c.total, 0) / diasPed : null,
    },
  };
}

/**
 * Pontos da curva. Por mês relativo: x = 1..n. Por % do prazo (protótipo): pessoas no meio de
 * cada mês ((j + 0,5) ÷ n), custo acumulado no fim de cada mês ((j + 1) ÷ n), começando em 0.
 */
export function pontos(o: ObraComparada, curva: Curva, eixo: Eixo): [number, number][] {
  const n = o.meses;
  if (curva === "pessoas") {
    const y = o.totais.map((t) => (o.area ? (t / o.area) * 1000 : 0));
    return eixo === "mes"
      ? y.map((v, j) => [j + 1, v])
      : [[0, 0], ...y.map((v, j): [number, number] => [((j + 0.5) / n) * 100, v]), [100, 0]];
  }
  const tot = o.r.total.total || 1;
  let acc = 0;
  const y = o.r.porMes.map((m) => {
    acc += m.total;
    return (acc / tot) * 100;
  });
  return eixo === "mes"
    ? [[0, 0], ...y.map((v, j): [number, number] => [j + 1, v])]
    : [[0, 0], ...y.map((v, j): [number, number] => [((j + 1) / n) * 100, v])];
}
