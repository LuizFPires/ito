/**
 * Base histórica (M5): lista de obras com o resumo em cache, obra completa para o detalhe e
 * recálculo dos resumos desatualizados (obra editada, tabela vigente nova, versão do cálculo).
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MesParaGravar } from "@ito/carga";
import type { ContextoCarga } from "./carga";
import type { ObraBanco, Resumo } from "../lib/obraDoBanco";
import { resumoDaObra, VERSAO_RESUMO } from "../lib/obraDoBanco";
import type { Situacao } from "../lib/situacao";
import { supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/tipos-banco";
import { carregarObrasBanco as carregarObrasBancoDe } from "./carregar";

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
  situacao: Situacao;
  prazo_previsto: number | null;
  resumo: Resumo | null;
}

const COLUNAS =
  "id, nome, cliente, tipologia, grupo, cidade_id, area_m2, inicio, meses, data_base, situacao, prazo_previsto";

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
        todas((de, ate) =>
          supabase.from("obra_resumo").select("*").order("obra_id").range(de, ate),
        ),
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
                contexto: r.contexto,
                revisao: r.revisao,
                pico: Number(r.pico),
                pessoa_mes: Number(r.pessoa_mes),
                he_por_pessoa: Number(r.he_por_pessoa),
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

/**
 * Resumo que precisa ser recalculado: não existe, obra editada (versão 0), outra versão do cálculo
 * ou parâmetros diferentes (tabela vigente nova, salário, encargo, função, calendário).
 */
export const desatualizado = (r: Resumo | null, vigente: number, contexto: string) =>
  !r || r.versao !== VERSAO_RESUMO || r.vigente !== vigente || r.contexto !== contexto;

/** Dados de cálculo de várias obras (resumo, referências da projeção): ver `carregar.ts`. */
export const carregarObrasBanco = (ids: readonly string[]) => carregarObrasBancoDe(supabase, ids);

/**
 * Recalcula os resumos desatualizados no navegador; grava no banco quando o usuário pode
 * (quem carrega ou a controladoria). Devolve os resumos novos para a tela usar já.
 */
export async function atualizarResumos(
  ids: readonly string[],
  ctx: ContextoCarga,
  contexto: string,
  podeGravar: boolean,
): Promise<{ resumos: Resumo[]; falhas: Record<string, string> }> {
  if (!ids.length) return { resumos: [], falhas: {} };
  const obras = await carregarObrasBanco(ids);
  const resumos: Resumo[] = [];
  const falhas: Record<string, string> = {};
  for (const b of obras) {
    try {
      resumos.push(resumoDaObra(b, ctx.ctx, ctx.tabelas, ctx.vigente, contexto));
    } catch (e) {
      // obra que o motor recusa (cadastro mudou): fica sem resumo, com o motivo na linha
      falhas[b.obra.id] = e instanceof Error ? e.message : "A obra não pôde ser calculada.";
    }
  }
  if (podeGravar && resumos.length)
    await ok(supabase.rpc("gravar_resumos", { p: resumos as unknown as Json }));
  return { resumos, falhas };
}

export function useInvalidarObras() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ["obras"] }), [qc]);
}

export type LinhaLancamento = T["lancamentos"]["Row"];

// ── detalhe da obra ──────────────────────────────────────────────────────────

export interface DetalheObra extends ObraBanco {
  realocacoes: T["realocacoes"]["Row"][];
  notas: T["notas_fiscais"]["Row"][];
  erp: T["erp_realizado"]["Row"][];
}

export function useObra(id: string | undefined) {
  return useQuery({
    queryKey: chavesObras.obra(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<DetalheObra | null> => {
      // tudo numa rodada só (M12: antes, a obra e depois o resto)
      const [[b], realocacoes, notas, erp] = await Promise.all([
        carregarObrasBanco([id!]),
        ok(supabase.from("realocacoes").select("*").eq("obra_id", id!).order("mes_ini")),
        ok(supabase.from("notas_fiscais").select("*").eq("obra_id", id!).order("mes_idx")),
        ok(supabase.from("erp_realizado").select("*").eq("obra_id", id!).order("mes_idx")),
      ]);
      if (!b) return null;
      return { ...b, realocacoes, notas, erp };
    },
  });
}

/** Lançamentos por matrícula com as rubricas (só quem carrega lê: RLS devolve vazio aos demais). */
export const consultaLancamentos = (id: string) => ({
  queryKey: ["obras", "lancamentos", id] as const,
  queryFn: () => carregarLancamentos(id),
});

export function useLancamentos(id: string | undefined, ativo: boolean) {
  return useQuery({ ...consultaLancamentos(id ?? ""), enabled: !!id && ativo });
}

async function carregarLancamentos(id: string) {
  const [lancamentos, rubricas] = await Promise.all([
    todas((de, ate) =>
      supabase
        .from("lancamentos")
        .select("*")
        .eq("obra_id", id)
        .order("mes_idx")
        .order("matricula")
        .range(de, ate),
    ),
    todas((de, ate) =>
      supabase
        .from("lancamento_rubricas")
        .select("mes_idx, matricula, funcao_id, construtora, rubrica_codigo, referencia, valor")
        .eq("obra_id", id)
        .order("mes_idx")
        .order("matricula")
        .order("rubrica_codigo")
        .range(de, ate),
    ),
  ]);
  return { lancamentos, rubricas };
}

// ── edição de premissas e ausências (decisão M5: quem carrega; RLS no banco) ─────

async function okLinhas<R>(p: PromiseLike<{ data: R[] | null; error: unknown }>): Promise<R[]> {
  const linhas = await ok(p);
  if (!linhas.length) throw { code: "SEM_LINHAS", message: "nenhuma linha afetada" };
  return linhas;
}

export const edicao = {
  obra: (id: string, patch: T["obras"]["Update"]) =>
    okLinhas(supabase.from("obras").update(patch).eq("id", id).select("id")),
  competencia: (id: string, mes: number, patch: T["competencias"]["Update"]) =>
    okLinhas(
      supabase
        .from("competencias")
        .update(patch)
        .eq("obra_id", id)
        .eq("mes_idx", mes)
        .select("mes_idx"),
    ),
  regime: async (id: string, funcao: string, sp: boolean) =>
    sp
      ? ok(
          supabase
            .from("obra_regime")
            .insert({ obra_id: id, funcao_id: funcao, regime: "sp" })
            .select(),
        )
      : okLinhas(
          supabase.from("obra_regime").delete().eq("obra_id", id).eq("funcao_id", funcao).select(),
        ),
  adicionarTroca: (id: string, mes: number, dataBase: number) =>
    ok(
      supabase
        .from("obra_trocas_tabela")
        .insert({ obra_id: id, mes_idx: mes, data_base: dataBase, motivo: "" })
        .select(),
    ),
  trocaTabela: (id: string, mes: number, dataBase: number) =>
    okLinhas(
      supabase
        .from("obra_trocas_tabela")
        .update({ data_base: dataBase })
        .eq("obra_id", id)
        .eq("mes_idx", mes)
        .select(),
    ),
  removerTroca: (id: string, mes: number) =>
    okLinhas(
      supabase.from("obra_trocas_tabela").delete().eq("obra_id", id).eq("mes_idx", mes).select(),
    ),
  adicionarFeriado: (id: string, data: string, nome: string) =>
    ok(supabase.from("obra_feriados").insert({ obra_id: id, data, nome }).select()),
  removerFeriado: (id: string, data: string) =>
    okLinhas(supabase.from("obra_feriados").delete().eq("obra_id", id).eq("data", data).select()),
};

// ── obra em andamento (M11): lançar mês, concluir e reabrir (quem carrega; regra no banco) ──

function useAoGravarObra() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["obras"] }),
      qc.invalidateQueries({ queryKey: ["carga"] }),
      qc.invalidateQueries({ queryKey: ["funcoes"] }),
      qc.invalidateQueries({ queryKey: ["rubricas"] }),
    ]);
}

export function useLancarMes() {
  const aoGravar = useAoGravarObra();
  return useMutation({
    mutationFn: async (p: MesParaGravar) =>
      ok(supabase.rpc("lancar_mes", { p: p as unknown as Json })),
    onSettled: aoGravar,
  });
}

export function useDefinirSituacao() {
  const aoGravar = useAoGravarObra();
  return useMutation({
    mutationFn: async ({ id, situacao }: { id: string; situacao: Situacao }) => {
      const { error } = await supabase.rpc("definir_situacao_obra", {
        p_id: id,
        p_situacao: situacao,
      });
      if (error) throw error;
    },
    onSettled: aoGravar,
  });
}
