/**
 * Projeções (M7): lista com o resumo, projeção completa, preços da cidade e gravação. O banco
 * guarda as entradas; o motor calcula na tela (decisão M7).
 */
import { useCallback, useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tabela } from "@ito/motor";
import type { Entradas, LinhaProjecao, Situacao } from "../lib/projecaoDoBanco";
import { entradasDaLinha, linhaDasEntradas } from "../lib/projecaoDoBanco";
import { supabase } from "../lib/supabase";
import { useToast } from "../ui/toast";
import { useContextoCarga } from "./carga";
import { carregarCctPrecos, montarPrecos } from "./carregar";
import { useCidades } from "./cidades";
import { carregarObrasBanco } from "./obras";
import { mensagemErroBanco } from "./erros";

async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

/** UPDATE/DELETE barrado pela RLS volta vazio: vira erro em vez de "Salvo". */
async function okLinhas<R>(p: PromiseLike<{ data: R[] | null; error: unknown }>): Promise<R[]> {
  const linhas = await ok(p);
  if (!linhas.length) throw { code: "SEM_LINHAS", message: "nenhuma linha afetada" };
  return linhas;
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

export const chavesProjecoes = {
  todas: ["projecoes"] as const,
  lista: ["projecoes", "lista"] as const,
  projecao: (id: string) => ["projecoes", "projecao", id] as const,
};

/** Resumo gravado com a projeção (para a lista); vazio até o primeiro cálculo. */
export type ResumoProjecao = {
  total?: number;
  pico?: number;
  pessoa_mes?: number;
  vigente?: number;
};

export type ItemProjecao = Omit<LinhaProjecao, "resumo"> & { resumo: ResumoProjecao };

/** Mais recentes primeiro (a lista e o seletor ‹ › seguem esta ordem). */
export function useProjecoes() {
  return useQuery({
    queryKey: chavesProjecoes.lista,
    queryFn: async (): Promise<ItemProjecao[]> =>
      (
        await todas((de, ate) =>
          supabase
            .from("projecoes")
            .select("*")
            .order("criado_em", { ascending: false })
            .order("id")
            .range(de, ate),
        )
      ).map((p) => ({ ...p, resumo: (p.resumo ?? {}) as ResumoProjecao })),
  });
}

export function useProjecao(id: string | undefined) {
  return useQuery({
    queryKey: chavesProjecoes.projecao(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<ItemProjecao | null> => {
      const p = await ok(supabase.from("projecoes").select("*").eq("id", id!).maybeSingle());
      return p ? { ...p, resumo: (p.resumo ?? {}) as ResumoProjecao } : null;
    },
  });
}

export type { CctComPrecos } from "./carregar";

/** CCT da cidade com os preços que o motor usa (mês da data-base e reajuste estimado). */
export const consultaCctPrecos = (cctId: string) => ({
  queryKey: ["projecoes", "cct", cctId] as const,
  queryFn: () => carregarCctPrecos(supabase, cctId),
});

export function useCctPrecos(cctId: string | null | undefined) {
  return useQuery({ ...consultaCctPrecos(cctId ?? ""), enabled: !!cctId });
}

export type { Tabela };

/** Obras de referência com os dados de cálculo (as que sumiram da base ficam de fora). */
export const consultaReferencias = (ids: readonly string[]) => {
  const chave = [...ids].sort().join(",");
  return {
    queryKey: ["projecoes", "refs", chave] as const,
    queryFn: () => carregarObrasBanco(chave.split(",")),
  };
};

export function useReferencias(ids: readonly string[]) {
  return useQuery({
    ...consultaReferencias(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
}

export { cidadeComPrecos, montarPrecos, origemPadrao } from "./carregar";

/**
 * Contexto do motor, cidades e preços da cidade da projeção (tabela vigente, CCT, VT, ISS).
 * `precos` fica nulo enquanto carrega.
 */
export function usePrecos(cidadeId: string | null, origemId: string | null) {
  const contexto = useContextoCarga();
  const cidadesQ = useCidades();
  const cidades = cidadesQ.data;
  const cid = cidades?.find((c) => c.id === cidadeId) ?? null;
  const cctQ = useCctPrecos(cid?.cct_id);
  const ctx = contexto.data;
  const tabela = ctx?.tabelas[ctx.vigente];
  const cct = cctQ.data;
  const precos = useMemo(
    () => (cidades ? montarPrecos(tabela, cidades, cidadeId, origemId, cct) : null),
    [tabela, cidades, cidadeId, origemId, cct],
  );
  return {
    contexto: ctx,
    cidades: cidades ?? [],
    cct: cid ? (cctQ.data ?? null) : null,
    precos,
    erro: contexto.isError || cidadesQ.isError || cctQ.isError,
  };
}

// ── gravação ─────────────────────────────────────────────────────────────────

const MENSAGENS: Record<string, string> = {
  SEM_LINHAS: "Você não pode alterar esta projeção (ou ela foi apagada). Atualize a página.",
  "23514":
    "Confira os dados: área maior que zero, prazo de 1 a 120 meses e reajuste dentro do prazo.",
};

function useGravar<A, R>(fn: (a: A) => Promise<R>, sucesso: string) {
  const qc = useQueryClient();
  const avisar = useToast();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (sucesso) avisar(sucesso);
    },
    onError: (e) => {
      const code = (e as { code?: string }).code ?? "";
      avisar(MENSAGENS[code] ?? mensagemErroBanco(e));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chavesProjecoes.todas }),
  });
  const gravar = (a: A) => {
    const p = m.mutateAsync(a);
    p.catch(() => {});
    return p;
  };
  return { ...m, gravar };
}

export function useCriarProjecao() {
  return useGravar(
    async ({ e, resumo }: { e: Entradas; resumo: ResumoProjecao }) =>
      (
        await ok(
          supabase
            .from("projecoes")
            .insert({ ...linhaDasEntradas(e), resumo })
            .select("id")
            .single(),
        )
      ).id,
    "Projeção salva",
  );
}

export function useAtualizarProjecao() {
  return useGravar(
    ({ id, e, resumo }: { id: string; e: Entradas; resumo: ResumoProjecao }) =>
      okLinhas(
        supabase
          .from("projecoes")
          .update({ ...linhaDasEntradas(e), resumo })
          .eq("id", id)
          .select("id"),
      ),
    "Projeção salva",
  );
}

/** Cópia com " (cópia)" no nome, em rascunho (o banco define autor e situação). */
export function useDuplicarProjecao() {
  return useGravar(async (p: ItemProjecao) => {
    const e = entradasDaLinha(p);
    return (
      await ok(
        supabase
          .from("projecoes")
          .insert({
            ...linhaDasEntradas({ ...e, nome: `${e.nome} (cópia)` }),
            resumo: p.resumo,
          })
          .select("id")
          .single(),
      )
    ).id;
  }, "Projeção duplicada em rascunho");
}

export function useApagarProjecao() {
  return useGravar(
    (id: string) => okLinhas(supabase.from("projecoes").delete().eq("id", id).select("id")),
    "Projeção apagada",
  );
}

/**
 * Aprovar (M14 · S05): a Edge Function `projecoes` refaz o cálculo no servidor e grava os
 * números dela; as outras situações mudam por `definir_situacao`.
 */
async function aprovarNoServidor(id: string) {
  const { data, error } = await supabase.functions.invoke("projecoes", {
    body: { acao: "aprovar", id },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = "Não foi possível aprovar agora. Tente de novo.";
    try {
      const j = (await ctx?.json()) as { erro?: string } | undefined;
      if (j?.erro) msg = j.erro;
    } catch {
      /* resposta sem JSON: fica a mensagem genérica */
    }
    // 22023: a tela mostra o texto como veio (o servidor já diz o que fazer)
    throw { code: "22023", message: msg };
  }
  return data as { id: string; resumo: ResumoProjecao };
}

export function useDefinirSituacao() {
  return useGravar(
    (a: { id: string; situacao: Situacao }) =>
      a.situacao === "aprovada"
        ? aprovarNoServidor(a.id)
        : ok(supabase.rpc("definir_situacao", { p_id: a.id, p_situacao: a.situacao })),
    "Situação alterada",
  );
}

/**
 * Resumo da lista recalculado na tela (tabela vigente nova, cadastro mudou). Falha em silêncio:
 * quem só lê não grava, e a lista segue com o resumo calculado na hora.
 */
export function useGravarResumoProjecao() {
  const qc = useQueryClient();
  return useCallback(
    async (id: string, resumo: ResumoProjecao) => {
      const { error } = await supabase.from("projecoes").update({ resumo }).eq("id", id);
      if (!error) await qc.invalidateQueries({ queryKey: chavesProjecoes.lista });
    },
    [qc],
  );
}
