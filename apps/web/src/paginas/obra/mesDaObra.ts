/**
 * Lançar mês na obra em andamento (M11), lógica pura: o "rascunho" do mês a partir da obra da
 * base e a preparação (montagem do mês encaixada na obra + verificações só do mês).
 */
import { encaixarMes, ESCOLHAS_VAZIAS, montarCarga, verificarCarga } from "@ito/carga";
import { anoMes } from "@ito/motor";
import type { ContextoCarga, RascunhoCarga } from "../../dados/carga";
import type { ObraBanco } from "../../lib/obraDoBanco";
import { inicioDe, obraDoBanco, parametrosDe } from "../../lib/obraDoBanco";
import type { Preparada } from "../carga/estado";
import { dadosParaMontagem, parametrosDaObra } from "../carga/estado";

/** Data-base em vigor no mês (a da obra ou a da última troca de tabela até ele). */
export function dataBaseNoMes(b: Pick<ObraBanco, "obra" | "trocas">, mes: number): number {
  const antes = b.trocas.filter((t) => t.mes_idx <= mes).sort((x, y) => x.mes_idx - y.mes_idx);
  return antes.at(-1)?.data_base ?? b.obra.data_base;
}

/**
 * O mês como uma obra de 1 mês que começa na competência dele (a folha de outro mês vira
 * pendência "fora do período"), com a cidade, a área e o regime S/P da obra.
 */
export function rascunhoDoMes(b: ObraBanco, mes: number): RascunhoCarga {
  const o = b.obra;
  return {
    versao: 1,
    dados: {
      id: o.id,
      nome: o.nome,
      cliente: o.cliente,
      tipologia: o.tipologia,
      cidadeId: o.cidade_id,
      area: Number(o.area_m2),
      inicio: anoMes(inicioDe(o.inicio), mes),
      meses: 1,
      dataBase: dataBaseNoMes(b, mes),
      trocas: [],
      feriados: [],
      premissas: {},
      regime: Object.fromEntries(b.regime.map((x) => [x.funcao_id, x.regime])),
    },
    arquivos: {},
    leituras: null,
    escolhas: ESCOLHAS_VAZIAS,
  };
}

/**
 * Montagem do mês encaixada na obra e verificações só dele (o caixa do mês depende dos
 * anteriores). As notas fiscais enviadas no lançamento são do mês. Null sem folha.
 */
export function prepararMes(
  r: RascunhoCarga,
  b: ObraBanco,
  mes: number,
  ctx: ContextoCarga,
): Preparada | null {
  if (!r.leituras || !r.arquivos.folha) return null;
  const dados = dadosParaMontagem(r.dados, ctx);
  const escolhas = {
    ...r.escolhas,
    nfMes: Object.fromEntries(
      (r.leituras.notas ?? []).map((n) => [`${n.prestadorCnpj}|${n.numero}`, 0]),
    ),
  };
  const doMes = montarCarga(
    dados,
    r.leituras,
    ctx.cadastro,
    escolhas,
    parametrosDaObra(dados, ctx),
  );
  const montagem = encaixarMes(obraDoBanco(b), doMes, mes);
  const verificacao = verificarCarga(
    montagem,
    r.leituras,
    escolhas,
    ctx.cadastro,
    ctx.ctx,
    parametrosDe(b, ctx.tabelas, ctx.vigente, "epoca"),
    { meses: [mes] },
  );
  return { montagem, verificacao };
}
