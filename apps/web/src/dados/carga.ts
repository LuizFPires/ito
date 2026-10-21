/**
 * Dados da carga (M4): cadastros que a leitura usa, rascunhos por usuário e a gravação
 * (`gravar_carga`, uma transação). O arquivo original não sobe: o navegador lê, descarta nomes e
 * só os dados com matrícula vão para o rascunho e para o banco (decisão M4).
 */
import type {
  Cadastro,
  CargaParaGravar,
  DadosObra,
  Escolhas,
  Leituras,
  RubricaCadastro,
  TipoArquivo,
} from "@ito/carga";
import type { Contexto, FeriadoRecorrente, Tabela } from "@ito/motor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contextoDoBanco, tabelaDoBanco } from "../lib/motorDoBanco";
import { supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/tipos-banco";
import { useToast } from "../ui/toast";
import { mensagemErroBanco } from "./erros";

type T = Database["public"]["Tables"];

async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

/** Todas as linhas, de 1.000 em 1.000 (limite do PostgREST). */
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

export interface ContextoCarga {
  cadastro: Cadastro;
  ctx: Contexto;
  /** tabela da empresa por data-base (época) */
  tabelas: Record<number, Tabela>;
  vigente: number;
  datasBase: number[];
  justificativas: string[];
  /** funções ativas, para mapear e para criar sinônimo */
  funcoes: { id: string; nome: string; grupo: T["funcoes"]["Row"]["grupo"] }[];
  cidades: { id: string; nome: string; feriados: FeriadoRecorrente[] }[];
  obras: { id: string; nome: string }[];
}

const chaves = {
  contexto: ["carga", "contexto"] as const,
  rascunhos: ["carga", "rascunhos"] as const,
  rascunho: (id: string) => ["carga", "rascunho", id] as const,
};

async function carregarContexto(): Promise<ContextoCarga> {
  const [
    funcoes,
    sinonimos,
    rubricas,
    beneficios,
    parametros,
    feriadosEmpresa,
    datas,
    salarios,
    valoresBen,
    encargos,
    just,
    cidades,
    ferCid,
    obras,
  ] = await Promise.all([
    ok(supabase.from("funcoes").select("*").order("nome")),
    ok(supabase.from("funcao_sinonimos").select("*")),
    ok(supabase.from("rubricas").select("*").order("codigo")),
    ok(supabase.from("beneficios").select("*")),
    ok(supabase.from("parametros").select("*").single()),
    ok(supabase.from("feriados_empresa").select("*")),
    ok(supabase.from("datas_base").select("*").order("ano", { ascending: false })),
    ok(supabase.from("data_base_salarios").select("*")),
    ok(supabase.from("data_base_beneficios").select("*")),
    ok(supabase.from("data_base_encargos").select("*")),
    ok(supabase.from("justificativas_erp").select("*").order("ordem")),
    todas((de, ate) =>
      supabase.from("cidades").select("id, nome, uf").order("nome").order("id").range(de, ate),
    ),
    todas((de, ate) =>
      supabase.from("cidade_feriados").select("*").order("cidade_id").range(de, ate),
    ),
    todas((de, ate) => supabase.from("obras").select("id, nome").order("nome").range(de, ate)),
  ]);

  const tabelas: Record<number, Tabela> = {};
  for (const d of datas) {
    const sal = Object.fromEntries(
      salarios.filter((s) => s.ano === d.ano).map((s) => [s.funcao_id, Number(s.valor)]),
    );
    const ben = Object.fromEntries(
      valoresBen.filter((b) => b.ano === d.ano).map((b) => [b.beneficio_id, Number(b.valor)]),
    );
    tabelas[d.ano] = tabelaDoBanco(
      d,
      sal,
      ben,
      encargos.filter((e) => e.ano === d.ano),
    );
  }

  const rubricasCad: RubricaCadastro[] = rubricas.map((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo,
    componente: r.componente,
    baseProvisoes: r.base_provisoes,
    tipoHe: (r.tipo_he as RubricaCadastro["tipoHe"]) ?? null,
  }));

  return {
    cadastro: {
      // inativas também: o histórico pode ter função que hoje não se usa
      funcoes: contextoDoBanco(funcoes, [], parametros, []).funcoes,
      nomesFuncoes: Object.fromEntries(funcoes.map((f) => [f.id, f.nome])),
      sinonimos: Object.fromEntries(sinonimos.map((s) => [s.texto, s.funcao_id])),
      rubricas: rubricasCad,
    },
    ctx: contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa),
    tabelas,
    vigente: parametros.data_base_vigente ?? datas[0]?.ano ?? new Date().getFullYear(),
    datasBase: datas.map((d) => d.ano),
    justificativas: just.map((j) => j.texto),
    funcoes: funcoes
      .filter((f) => f.ativo)
      .map((f) => ({ id: f.id, nome: f.nome, grupo: f.grupo })),
    cidades: cidades.map((c) => ({
      id: c.id,
      nome: `${c.nome}/${c.uf}`,
      feriados: ferCid
        .filter((f) => f.cidade_id === c.id)
        .map((f) => ({ dia: f.dia, mes: f.mes, nome: f.nome })),
    })),
    obras,
  };
}

export function useContextoCarga() {
  return useQuery({ queryKey: chaves.contexto, queryFn: carregarContexto });
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
  const r = await ok(supabase.from("carga_rascunhos").select("etapa, dados").eq("id", id).single());
  return { etapa: r.etapa, conteudo: r.dados as unknown as RascunhoCarga };
}

/** Salva (cria na primeira vez) e devolve o id. */
export async function salvarRascunho(
  id: string | null,
  titulo: string,
  etapa: number,
  conteudo: RascunhoCarga,
): Promise<string> {
  const dados = conteudo as unknown as NonNullable<Json>;
  if (id) {
    const r = await ok(
      supabase.from("carga_rascunhos").update({ titulo, etapa, dados }).eq("id", id).select("id"),
    );
    if (r.length) return id;
  }
  const r = await ok(
    supabase.from("carga_rascunhos").insert({ titulo, etapa, dados }).select("id").single(),
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
