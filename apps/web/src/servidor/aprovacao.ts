/**
 * Aprovação calculada no servidor (M14 · S05). A Edge Function `projecoes` empacota este arquivo
 * (scripts/gerar-calculo.mjs) e o chama com o cliente de quem aprova: os mesmos carregadores e o
 * mesmo motor da tela refazem o cálculo, e o banco grava esses números, não os do navegador.
 * Sem React e sem `import.meta.env`: só dados entrando e números saindo.
 */
import type { Cliente } from "../dados/carregar";
import {
  carregarCidades,
  carregarContexto,
  carregarCctPrecos,
  carregarObrasBanco,
  montarPrecos,
  ok,
} from "../dados/carregar";
import { calcularProjecao, entradasDaLinha, resumoDaProjecao } from "../lib/projecaoDoBanco";

/** Hash do código de cálculo empacotado (trocado pelo gerador; na tela fica o marcador). */
export const VERSAO_CALCULO = "__VERSAO_CALCULO__";

export class ErroAprovacao extends Error {}

export interface Aprovacao {
  resumo: { total: number; pico: number; pessoa_mes: number; vigente: number };
  /** carimbo da linha lida: o banco recusa se a projeção mudou durante o cálculo */
  atualizadoEm: string;
  registro: {
    entradas: Record<string, unknown>;
    precos: unknown;
    referencias: { id: string; revisao: number }[];
    versao_calculo: string;
  };
}

export async function calcularAprovacao(c: Cliente, id: string): Promise<Aprovacao> {
  const linha = await ok(c.from("projecoes").select("*").eq("id", id).maybeSingle());
  if (!linha) throw new ErroAprovacao("A projeção não existe. Atualize a página.");
  const e = entradasDaLinha(linha);
  const [contexto, cidades] = await Promise.all([carregarContexto(c), carregarCidades(c)]);
  const cid = cidades.find((x) => x.id === e.cidadeId) ?? null;
  const cct = cid ? await carregarCctPrecos(c, cid.cct_id) : undefined;
  const precos = montarPrecos(
    contexto.tabelas[contexto.vigente],
    cidades,
    e.cidadeId,
    e.cidadeOrigemId,
    cct,
  );
  if (!precos)
    throw new ErroAprovacao(
      "Faltam os preços da cidade ou a tabela vigente. Confira os cadastros.",
    );
  const refs = e.referencias.length
    ? (await carregarObrasBanco(c, e.referencias)).filter((b) => e.referencias.includes(b.obra.id))
    : [];
  const calc = calcularProjecao(e, refs, precos, contexto.ctx);
  const resumo = resumoDaProjecao(calc, contexto.vigente);
  if (resumo.total === undefined)
    throw new ErroAprovacao("A projeção não calcula com os dados atuais. Abra-a e confira.");
  const entradas: Record<string, unknown> = { ...linha };
  delete entradas.resumo;
  return {
    resumo: resumo as Aprovacao["resumo"],
    atualizadoEm: linha.atualizado_em,
    registro: {
      entradas,
      precos,
      referencias: refs.map((b) => ({ id: b.obra.id, revisao: b.obra.revisao })),
      versao_calculo: VERSAO_CALCULO,
    },
  };
}
