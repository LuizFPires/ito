/**
 * Lançar mês na obra em andamento (PLAN M11): a folha de uma competência é montada como uma obra
 * de um mês (mesmas leituras, pendências e quantidades da carga) e depois encaixada na obra que
 * já está na base, no índice do mês. A verificação roda sobre a obra inteira (o caixa do mês
 * depende dos anteriores), mas confere só o mês lançado.
 */
import type { Movimentos, Obra } from "@ito/motor";
import type { CargaParaGravar, Montagem } from "./montagem";

/** Payload de `lancar_mes` (supabase/migrations/…_obras_em_andamento.sql). */
export interface MesParaGravar {
  obra_id: string;
  mes_idx: number;
  sinonimos: CargaParaGravar["sinonimos"];
  rubricas_novas: CargaParaGravar["rubricas_novas"];
  regime: CargaParaGravar["regime"];
  feriados: CargaParaGravar["feriados"];
  competencias: CargaParaGravar["competencias"];
  lancamentos: CargaParaGravar["lancamentos"];
  realocacoes: CargaParaGravar["realocacoes"];
  notas: CargaParaGravar["notas"];
  erp: CargaParaGravar["erp"];
}

const encaixar = (
  base: readonly number[] | undefined,
  valor: number,
  n: number,
  mes: number,
): number[] => {
  const s = Array.from({ length: n }, (_, i) => base?.[i] ?? 0);
  s[mes] = valor;
  return s;
};

function encaixarSeries(
  base: Readonly<Record<string, readonly number[]>>,
  doMes: Readonly<Record<string, readonly number[]>>,
  n: number,
  mes: number,
): Record<string, number[]> {
  const ids = new Set([...Object.keys(base), ...Object.keys(doMes)]);
  return Object.fromEntries(
    [...ids].map((f) => [f, encaixar(base[f], doMes[f]?.[0] ?? 0, n, mes)]),
  );
}

/**
 * Encaixa a montagem de um mês (obra de 1 mês começando na competência) na obra da base, no mês
 * `mes`: as séries ganham o mês (substituído, se já lançado), o payload vai para o índice da obra.
 * Premissas e rotatividade ficam as da obra; o mix de HE é o do mês, se ele tiver HE.
 */
export function encaixarMes(
  base: { obra: Obra; movimentos: Movimentos },
  doMes: Montagem,
  mes: number,
): Montagem {
  const b = base.obra;
  const m = doMes.obra;
  const n = Math.max(b.meses ?? 0, mes + 1);
  const comHe = Object.values(doMes.heHorasPorTipo).some((h) => h > 0);
  const vistos = new Set<string>();
  const feriados = [...(b.feriadosMunicipais ?? []), ...(m.feriadosMunicipais ?? [])].filter(
    (x) => !vistos.has(x.data) && !!vistos.add(x.data),
  );
  const obra: Obra = {
    ...b,
    meses: n,
    equivalente: encaixarSeries(b.equivalente, m.equivalente, n, mes),
    cabecas: encaixarSeries(b.cabecas ?? {}, m.cabecas ?? {}, n, mes),
    heMedia: encaixar(b.heMedia, m.heMedia[0] ?? 0, n, mes),
    absenteismoPct: encaixar(b.absenteismoPct, m.absenteismoPct[0] ?? 0, n, mes),
    licencaPessoaDias: encaixar(b.licencaPessoaDias, m.licencaPessoaDias?.[0] ?? 0, n, mes),
    feriasPessoaDias: encaixar(b.feriasPessoaDias, m.feriasPessoaDias?.[0] ?? 0, n, mes),
    heMixPct: comHe ? m.heMixPct : b.heMixPct,
    regime: { ...b.regime, ...m.regime },
    feriadosMunicipais: feriados,
  };
  const movimentos: Movimentos = {
    admissoes: encaixarSeries(base.movimentos.admissoes, doMes.movimentos.admissoes, n, mes),
    desligamentos: encaixarSeries(
      base.movimentos.desligamentos,
      doMes.movimentos.desligamentos,
      n,
      mes,
    ),
  };
  const p = doMes.payload;
  const payload: CargaParaGravar = {
    ...p,
    competencias: p.competencias.map((c) => ({ ...c, mes_idx: c.mes_idx + mes })),
    lancamentos: p.lancamentos.map((l) => ({ ...l, mes_idx: l.mes_idx + mes })),
    realocacoes: p.realocacoes.map((r) => ({
      ...r,
      mes_ini: r.mes_ini + mes,
      mes_fim: r.mes_fim + mes,
    })),
    notas: p.notas.map((x) => ({ ...x, mes_idx: x.mes_idx === null ? null : x.mes_idx + mes })),
    erp: p.erp.map((e) => ({ ...e, mes_idx: e.mes_idx + mes })),
  };
  return {
    ...doMes,
    obra,
    movimentos,
    payload,
    semPessoa: doMes.semPessoa.map((x) => ({ ...x, mesIdx: x.mesIdx + mes })),
    negativos: doMes.negativos.map((x) => ({ ...x, mesIdx: x.mesIdx + mes })),
  };
}

/** O que `lancar_mes` grava, a partir do payload verificado (com a apropriação × ERP). */
export function mesParaGravar(obraId: string, mes: number, p: CargaParaGravar): MesParaGravar {
  return {
    obra_id: obraId,
    mes_idx: mes,
    sinonimos: p.sinonimos,
    rubricas_novas: p.rubricas_novas,
    regime: p.regime,
    feriados: p.feriados,
    competencias: p.competencias.filter((c) => c.mes_idx === mes),
    lancamentos: p.lancamentos,
    realocacoes: p.realocacoes,
    notas: p.notas,
    erp: p.erp,
  };
}
