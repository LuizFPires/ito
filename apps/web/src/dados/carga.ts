/**
 * Dados da carga (M4): cadastros que a leitura usa, rascunhos por usuário e a gravação
 * (`gravar_carga`, uma transação). O arquivo original não sobe: o navegador lê, descarta nomes e
 * só os dados com matrícula vão para o rascunho e para o banco (decisão M4).
 */
import type { CargaParaGravar, DadosObra, Escolhas, Leituras, TipoArquivo } from "@ito/carga";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/tipos-banco";
import { useToast } from "../ui/toast";
import { carregarContexto } from "./carregar";
import { mensagemErroBanco } from "./erros";

type T = Database["public"]["Tables"];

async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

export type { ContextoCarga } from "./carregar";

const chaves = {
  contexto: ["carga", "contexto"] as const,
  rascunhos: ["carga", "rascunhos"] as const,
  rascunho: (id: string) => ["carga", "rascunho", id] as const,
};

export function useContextoCarga() {
  return useQuery({ queryKey: chaves.contexto, queryFn: () => carregarContexto(supabase) });
}

// ── rascunho ─────────────────────────────────────────────────────────────────

/** Rascunho: só dados lidos (matrícula, nunca nome) e as escolhas de quem carrega. */
export interface RascunhoCarga {
  versao: 1;
  dados: DadosObra;
  /** nome do arquivo e o que foi lido, por tipo */
  arquivos: Partial<Record<TipoArquivo, { nome: string; resumo: string; erros: string[] }>>;
  leituras: Leituras | null;
  escolhas: Escolhas;
}

export interface ItemRascunho {
  id: string;
  titulo: string;
  etapa: number;
  atualizado_em: string;
  meu: boolean;
}

export function useRascunhos(usuarioId: string | undefined) {
  return useQuery({
    queryKey: chaves.rascunhos,
    enabled: !!usuarioId,
    queryFn: async (): Promise<ItemRascunho[]> => {
      const r = await ok(
        supabase
          .from("carga_rascunhos")
          .select("id, titulo, etapa, atualizado_em, usuario_id")
          .order("atualizado_em", { ascending: false }),
      );
      return r.map(({ usuario_id, ...x }) => ({ ...x, meu: usuario_id === usuarioId }));
    },
  });
}

export async function lerRascunho(id: string): Promise<{ etapa: number; conteudo: RascunhoCarga }> {
  const r = await ok(
    supabase.from("carga_rascunhos").select("etapa, dados, leituras").eq("id", id).single(),
  );
  const conteudo = r.dados as unknown as RascunhoCarga;
  return {
    etapa: r.etapa,
    conteudo: { ...conteudo, leituras: (r.leituras as Leituras | null) ?? null },
  };
}

/** O rascunho foi apagado (gravado na base, ou por um administrador) enquanto estava aberto. */
export class RascunhoApagado extends Error {}

/**
 * Salva (cria na primeira vez) e devolve o id. As leituras dos arquivos (a folha inteira) vão
 * numa coluna própria e só sobem quando `comLeituras` (um arquivo mudou); o resto é pequeno.
 * Rascunho que sumiu não é recriado.
 */
export async function salvarRascunho(
  id: string | null,
  titulo: string,
  etapa: number,
  conteudo: RascunhoCarga,
  comLeituras: boolean,
): Promise<string> {
  const { leituras, ...resto } = conteudo;
  const dados = resto as unknown as NonNullable<Json>;
  const extra = comLeituras || !id ? { leituras: leituras as unknown as Json } : {};
  if (id) {
    const r = await ok(
      supabase
        .from("carga_rascunhos")
        .update({ titulo, etapa, dados, ...extra })
        .eq("id", id)
        .select("id"),
    );
    if (!r.length) throw new RascunhoApagado();
    return id;
  }
  const r = await ok(
    supabase
      .from("carga_rascunhos")
      .insert({ titulo, etapa, dados, ...extra })
      .select("id")
      .single(),
  );
  return r.id;
}

export function useApagarRascunho() {
  const qc = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: (id: string) =>
      ok(supabase.from("carga_rascunhos").delete().eq("id", id).select("id")),
    onSuccess: () => avisar("Rascunho apagado"),
    onError: (e) => avisar(mensagemErroBanco(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.rascunhos }),
  });
}

// ── gravação ─────────────────────────────────────────────────────────────────

export function useGravarCarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payload,
      rascunho,
    }: {
      payload: CargaParaGravar;
      rascunho: string | null;
    }) => {
      const id = await ok(supabase.rpc("gravar_carga", { p: payload as unknown as Json }));
      if (rascunho) await supabase.from("carga_rascunhos").delete().eq("id", rascunho);
      return id as string;
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["carga"] }),
        qc.invalidateQueries({ queryKey: ["funcoes"] }),
        qc.invalidateQueries({ queryKey: ["rubricas"] }),
        qc.invalidateQueries({ queryKey: ["obras"] }),
      ]),
  });
}

export type ObraLinha = T["obras"]["Row"];
