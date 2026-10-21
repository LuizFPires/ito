/**
 * Base histórica (M5): lista de obras com o resumo em cache, obra completa para o detalhe e
 * recálculo dos resumos desatualizados (obra editada, tabela vigente nova, versão do cálculo).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContextoCarga } from "./carga";
import type { ObraBanco, Resumo } from "../lib/obraDoBanco";
import { resumoDaObra, VERSAO_RESUMO } from "../lib/obraDoBanco";
import { supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/tipos-banco";

type T = Database["public"]["Tables"];

async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

async function todas<R>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: R[] | null; error: unknown }>,
): Promise<R[]> {
  const linhas: R[] = [];
  for (let de = 0; ; de += 1000) {
    const lote = await ok(pagina(de, de + 999));
    linhas.push(...lote);
    if (lote.length < 1000) return linhas;
  }
}

export interface ObraLista {
  id: string;
  nome: string;
  cliente: string;
  tipologia: string;
  grupo: string;
  cidade_id: string | null;
  area_m2: number;
  inicio: string;
  meses: number;
  data_base: number;
  resumo: Resumo | null;
}

const COLUNAS = "id, nome, cliente, tipologia, grupo, cidade_id, area_m2, inicio, meses, data_base";

export const chavesObras = {
  lista: ["obras", "lista"] as const,
  obra: (id: string) => ["obras", "obra", id] as const,
};

export function useListaObras() {
  return useQuery({
    queryKey: chavesObras.lista,
    queryFn: async (): Promise<ObraLista[]> => {
      const [obras, resumos] = await Promise.all([
        todas((de, ate) => supabase.from("obras").select(COLUNAS).order("nome").range(de, ate)),
        todas((de, ate) => supabase.from("obra_resumo").select("*").range(de, ate)),
      ]);
      const por = new Map(resumos.map((r) => [r.obra_id, r]));
      return obras.map((o) => {
        const r = por.get(o.id);
        return {
          ...o,
          area_m2: Number(o.area_m2),
          resumo: r
            ? {
                obra_id: r.obra_id,
                vigente: r.vigente,
                versao: r.versao,
                pico: Number(r.pico),
                pessoa_mes: Number(r.pessoa_mes),
                he_por_pessoa: Number(r.he_por_pessoa),
                indireta_pct: Number(r.indireta_pct),
                custo_epoca: Number(r.custo_epoca),
                custo_atual: Number(r.custo_atual),
                histograma: r.histograma.map(Number),
              }
            : null,
        };
      });
    },
  });
}

/** Resumo que precisa ser recalculado (não existe, obra editada, outra vigente, outra versão). */
export const desatualizado = (o: ObraLista, vigente: number) =>
  !o.resumo || o.resumo.versao !== VERSAO_RESUMO || o.resumo.vigente !== vigente;

/** Dados de cálculo de várias obras (para o resumo), em lotes de 50. */
export async function carregarObrasBanco(ids: readonly string[]): Promise<ObraBanco[]> {
  const saida: ObraBanco[] = [];
  for (let k = 0; k < ids.length; k += 50) {
    const lote = ids.slice(k, k + 50);
    const [obras, comps, efetivo, regime, trocas, feriados] = await Promise.all([
      ok(supabase.from("obras").select("*").in("id", lote)),
      todas((de, ate) =>
        supabase.from("competencias").select("*").in("obra_id", lote).range(de, ate),
      ),
      todas((de, ate) =>
        supabase.from("efetivo_mes").select("*").in("obra_id", lote).range(de, ate),
      ),
      ok(supabase.from("obra_regime").select("*").in("obra_id", lote)),
      ok(supabase.from("obra_trocas_tabela").select("*").in("obra_id", lote)),
      ok(supabase.from("obra_feriados").select("*").in("obra_id", lote)),
    ]);
    for (const o of obras)
      saida.push({
        obra: o,
        competencias: comps.filter((c) => c.obra_id === o.id),
        efetivo: efetivo.filter((e) => e.obra_id === o.id),
        regime: regime.filter((r) => r.obra_id === o.id),
        trocas: trocas.filter((t) => t.obra_id === o.id),
        feriados: feriados.filter((f) => f.obra_id === o.id),
      });
  }
  return saida;
}

/**
 * Recalcula os resumos desatualizados no navegador; grava no banco quando o usuário pode
 * (quem carrega ou a controladoria). Devolve os resumos novos para a tela usar já.
 */
export async function atualizarResumos(
  ids: readonly string[],
  ctx: ContextoCarga,
  podeGravar: boolean,
): Promise<Resumo[]> {
  if (!ids.length) return [];
  const obras = await carregarObrasBanco(ids);
  const resumos: Resumo[] = [];
  for (const b of obras) {
    try {
      resumos.push(resumoDaObra(b, ctx.ctx, ctx.tabelas, ctx.vigente));
    } catch {
      // obra que o motor recusa (cadastro mudou): fica sem resumo e aparece com "—"
    }
  }
  if (podeGravar && resumos.length)
    await ok(supabase.rpc("gravar_resumos", { p: resumos as unknown as Json }));
  return resumos;
}

export function useInvalidarObras() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["obras"] });
}

export type LinhaLancamento = T["lancamentos"]["Row"];
