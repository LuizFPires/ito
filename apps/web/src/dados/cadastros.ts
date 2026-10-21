import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/tipos-banco";
import { useToast } from "../ui/toast";
import { mensagemErroBanco } from "./erros";

type T = Database["public"]["Tables"];
export type Funcao = T["funcoes"]["Row"] & { sinonimos: string[] };
export type Rubrica = T["rubricas"]["Row"];
export type DataBase = T["datas_base"]["Row"];
export type Encargo = T["data_base_encargos"]["Row"];
export type Beneficio = T["beneficios"]["Row"];
export type Parametros = T["parametros"]["Row"];
export type FeriadoEmpresa = T["feriados_empresa"]["Row"];
export type GrupoFuncao = Database["public"]["Enums"]["grupo_funcao"];
export type TipoRubrica = Database["public"]["Enums"]["tipo_rubrica"];
export type ComponenteRubrica = Database["public"]["Enums"]["componente_rubrica"];

export const NOME_GRUPO: Record<GrupoFuncao, string> = {
  direta: "Direta",
  indireta: "Indireta",
  adm: "Administrativa",
};

export const NOME_COMPONENTE: Record<ComponenteRubrica, string> = {
  sal: "Salário",
  extras: "Adicionais",
  he: "Horas extras",
  dsr: "Reflexo DSR",
  faltas: "Faltas",
  resc: "Rescisão",
  ferr: "Ferramentas",
  provpaga: "Baixa de provisão",
  compgps: "Compensado na GPS",
  nao: "Não entra (desconto do empregado)",
  info: "Informativo",
};

/** Explicação de cada componente (com base no COMPR do protótipo ITO 2.0 e no PRD §3.9). */
export const DESCRICAO_COMPONENTE: Record<ComponenteRubrica, string> = {
  sal: "Horas normais e bolsa: entram como salário.",
  extras: "Gratificações, prêmios e adicionais legais.",
  he: "Horas extras por tipo.",
  dsr: "Reflexo das horas extras no repouso.",
  faltas: "Descontam do salário (entram negativas).",
  resc: "Verbas de rescisão.",
  ferr: "Indenizatória, sem encargos.",
  provpaga: "Já custeada pela provisão (férias gozadas).",
  compgps: "Compensado na guia do INSS: custo zero.",
  nao: "Desconto do empregado: fica fora do custo.",
  info: "Só para conferência.",
};

const chaves = {
  funcoes: ["funcoes"] as const,
  rubricas: ["rubricas"] as const,
  parametros: ["parametros"] as const,
  datasBase: ["datas-base"] as const,
  dataBase: (ano: number) => ["data-base", ano] as const,
  beneficios: ["beneficios"] as const,
  feriados: ["feriados-empresa"] as const,
};

/** Resultado do Supabase ou lança o erro (sem erro, `data` vem preenchido). */
async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

/**
 * Para UPDATE/DELETE: a RLS barra em silêncio (PostgREST devolve 200 com lista vazia).
 * Nenhuma linha afetada = nada foi gravado; vira erro para não mostrar "Salvo".
 */
async function okLinhas<R>(p: PromiseLike<{ data: R[] | null; error: unknown }>): Promise<R[]> {
  const linhas = await ok(p);
  if (!linhas.length) throw { code: "SEM_LINHAS", message: "nenhuma linha afetada" };
  return linhas;
}

/**
 * Mutação com aviso: "Salvo" no sucesso, frase de ação no erro, e recarrega as chaves.
 * `gravar` devolve uma promessa (para o campo voltar ao valor anterior se falhar) sem
 * deixar rejeição solta.
 */
function useGravar<A>(
  fn: (a: A) => Promise<unknown>,
  recarregar: readonly (readonly unknown[])[],
  sucesso = "Salvo",
  duplicado?: string,
) {
  const qc = useQueryClient();
  const avisar = useToast();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (sucesso) avisar(sucesso);
    },
    onError: (e) => {
      const err = e as { code?: string; message?: string };
      const propria = /\.\s*Use outro/.test(err.message ?? "");
      avisar(err.code === "23505" && duplicado && !propria ? duplicado : mensagemErroBanco(e));
    },
    onSettled: () => Promise.all(recarregar.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
  const gravar = (a: A) => {
    const p = m.mutateAsync(a);
    p.catch(() => {});
    return p;
  };
  return { ...m, gravar };
}

// ── parâmetros e datas-base ──────────────────────────────────────────────────

export function useParametros() {
  return useQuery({
    queryKey: chaves.parametros,
    queryFn: () => ok(supabase.from("parametros").select("*").single()),
  });
}

export function useDatasBase() {
  return useQuery({
    queryKey: chaves.datasBase,
    queryFn: () => ok(supabase.from("datas_base").select("*").order("ano", { ascending: false })),
  });
}

export interface DetalheDataBase {
  salarios: Record<string, number>;
  beneficios: Record<string, number>;
  encargos: Encargo[];
}

export function useDataBase(ano: number | undefined) {
  return useQuery({
    queryKey: chaves.dataBase(ano ?? 0),
    enabled: !!ano,
    queryFn: async (): Promise<DetalheDataBase> => {
      const [sal, ben, enc] = await Promise.all([
        ok(supabase.from("data_base_salarios").select("funcao_id, valor").eq("ano", ano!)),
        ok(supabase.from("data_base_beneficios").select("beneficio_id, valor").eq("ano", ano!)),
        ok(supabase.from("data_base_encargos").select("*").eq("ano", ano!).order("ordem")),
      ]);
      return {
        salarios: Object.fromEntries(sal.map((r) => [r.funcao_id, Number(r.valor)])),
        beneficios: Object.fromEntries(ben.map((r) => [r.beneficio_id, Number(r.valor)])),
        encargos: enc,
      };
    },
  });
}

export function useBeneficios() {
  return useQuery({
    queryKey: chaves.beneficios,
    queryFn: () => ok(supabase.from("beneficios").select("*").order("ordem")),
  });
}

export function useFeriadosEmpresa() {
  return useQuery({
    queryKey: chaves.feriados,
    queryFn: () => ok(supabase.from("feriados_empresa").select("*").order("data")),
  });
}

export function useAtualizarParametros() {
  return useGravar(
    (patch: T["parametros"]["Update"]) =>
      okLinhas(supabase.from("parametros").update(patch).eq("id", true).select()),
    [chaves.parametros],
  );
}

export function useAtualizarDataBase(ano: number) {
  return useGravar(
    (patch: T["datas_base"]["Update"]) =>
      okLinhas(supabase.from("datas_base").update(patch).eq("ano", ano).select()),
    [chaves.datasBase, chaves.dataBase(ano)],
  );
}

export function useGravarSalario(ano: number) {
  return useGravar(
    ({ funcao_id, valor }: { funcao_id: string; valor: number }) =>
      ok(supabase.from("data_base_salarios").upsert({ ano, funcao_id, valor }).select()),
    [chaves.dataBase(ano), chaves.funcoes],
  );
}

export function useGravarBeneficio(ano: number) {
  return useGravar(
    ({ beneficio_id, valor }: { beneficio_id: string; valor: number }) =>
      ok(supabase.from("data_base_beneficios").upsert({ ano, beneficio_id, valor }).select()),
    [chaves.dataBase(ano)],
  );
}

export function useAtualizarEncargo(ano: number) {
  return useGravar(
    ({ id, patch }: { id: string; patch: T["data_base_encargos"]["Update"] }) =>
      okLinhas(
        supabase.from("data_base_encargos").update(patch).eq("ano", ano).eq("id", id).select(),
      ),
    [chaves.dataBase(ano)],
  );
}

/** Nova data-base: sempre cópia da vigente + reajuste (decisão M1). */
export function useCriarDataBase() {
  return useGravar(
    (a: { ano: number; reajuste: number }) =>
      ok(supabase.rpc("criar_data_base", { p_ano: a.ano, p_reajuste_pct: a.reajuste })),
    [chaves.datasBase],
    "Data-base criada. Revise os valores antes de torná-la vigente.",
  );
}

export function useAdicionarFeriado() {
  return useGravar(
    (f: { data: string; nome: string }) => ok(supabase.from("feriados_empresa").insert(f).select()),
    [chaves.feriados],
    "Feriado da empresa adicionado",
    "Já existe um feriado da empresa nessa data.",
  );
}

export function useRemoverFeriado() {
  return useGravar(
    (data: string) =>
      okLinhas(supabase.from("feriados_empresa").delete().eq("data", data).select()),
    [chaves.feriados],
    "Feriado removido",
  );
}

// ── funções ──────────────────────────────────────────────────────────────────

/** `ativo` = false adia a consulta (ex.: busca global fechada). */
export function useFuncoes(ativo = true) {
  return useQuery({
    queryKey: chaves.funcoes,
    enabled: ativo,
    queryFn: async (): Promise<Funcao[]> => {
      const linhas = await ok(supabase.from("funcoes").select("*, funcao_sinonimos(texto)"));
      return linhas.map(({ funcao_sinonimos, ...f }) => ({
        ...f,
        sinonimos: (funcao_sinonimos ?? []).map((x) => x.texto).sort(),
      }));
    },
  });
}

/** Em quantas obras da base cada função teve efetivo (view funcao_obras). */
export function useObrasPorFuncao() {
  return useQuery({
    queryKey: ["obras", "por-funcao"],
    queryFn: async (): Promise<Record<string, number>> => {
      const r = await ok(supabase.from("funcao_obras").select("funcao_id, obras"));
      return Object.fromEntries(r.map((x) => [x.funcao_id ?? "", x.obras ?? 0]));
    },
  });
}

export function useAtualizarFuncao() {
  return useGravar(
    ({ id, patch }: { id: string; patch: T["funcoes"]["Update"] }) =>
      okLinhas(supabase.from("funcoes").update(patch).eq("id", id).select()),
    [chaves.funcoes],
  );
}

export function useCriarFuncao() {
  return useGravar(
    (f: { id: string; nome: string; grupo: GrupoFuncao; sinonimo?: string }) =>
      ok(
        supabase.rpc("criar_funcao", {
          p_id: f.id,
          p_nome: f.nome,
          p_grupo: f.grupo,
          p_sinonimo: f.sinonimo,
        }),
      ),
    // nasce com salário de oficial: recarrega também as data-bases
    [chaves.funcoes, ["data-base"]],
    "Função criada com o salário de oficial. Ajuste em Parâmetros → Salários.",
    "Já existe uma função com esse código. Use outro nome.",
  );
}

export function useAdicionarSinonimo() {
  return useGravar(
    (a: { texto: string; funcao_id: string }) =>
      ok(supabase.from("funcao_sinonimos").insert(a).select()),
    [chaves.funcoes],
    "Sinônimo adicionado",
    "Esse texto já é sinônimo de outra função. Remova-o de lá antes.",
  );
}

export function useRemoverSinonimo() {
  return useGravar(
    (texto: string) =>
      okLinhas(supabase.from("funcao_sinonimos").delete().eq("texto", texto).select()),
    [chaves.funcoes],
    "Sinônimo removido",
  );
}

// ── rubricas ─────────────────────────────────────────────────────────────────

export function useRubricas(ativo = true) {
  return useQuery({
    queryKey: chaves.rubricas,
    enabled: ativo,
    queryFn: () => ok(supabase.from("rubricas").select("*").order("codigo")),
  });
}

export function useAtualizarRubrica() {
  return useGravar(
    ({ codigo, patch }: { codigo: number; patch: T["rubricas"]["Update"] }) =>
      okLinhas(supabase.from("rubricas").update(patch).eq("codigo", codigo).select()),
    [chaves.rubricas],
  );
}

export function useCriarRubrica() {
  return useGravar(
    (r: T["rubricas"]["Insert"]) => ok(supabase.from("rubricas").insert(r).select()),
    [chaves.rubricas],
    "Rubrica criada. Confira a classificação.",
    "Já existe uma rubrica com esse código. Use outro.",
  );
}
