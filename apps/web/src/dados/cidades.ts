import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/tipos-banco";
import { useToast } from "../ui/toast";
import { carregarCct as carregarCctDe, carregarCidades } from "./carregar";
import { mensagemErroBanco } from "./erros";

type T = Database["public"]["Tables"];
export type Cct = T["ccts"]["Row"];
export type { Cidade, DetalheCct } from "./carregar";
export { nomeCidade } from "./carregar";

const chaves = {
  ccts: ["ccts"] as const,
  cct: (id: string) => ["cct", id] as const,
  todasCcts: ["cct"] as const,
  cidades: ["cidades"] as const,
};

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

function useGravar<A>(
  fn: (a: A) => Promise<unknown>,
  recarregar: readonly (readonly unknown[])[],
  sucesso = "Salvo",
  mensagens: Partial<Record<string, string>> = {},
) {
  const qc = useQueryClient();
  const avisar = useToast();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (sucesso) avisar(sucesso);
    },
    onError: (e) => {
      const code = (e as { code?: string }).code ?? "";
      avisar(mensagens[code] ?? mensagemErroBanco(e));
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

// ── leitura ──────────────────────────────────────────────────────────────────

/**
 * Lê todas as linhas, de 1.000 em 1.000 (limite do PostgREST, `max_rows`), para listas que
 * crescem com o cadastro (centenas de cidades, milhares de feriados).
 */
async function todas<R>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: R[] | null; error: unknown }>,
): Promise<R[]> {
  const TAM = 1000;
  const linhas: R[] = [];
  for (let de = 0; ; de += TAM) {
    const lote = await ok(pagina(de, de + TAM - 1));
    linhas.push(...lote);
    if (lote.length < TAM) return linhas;
  }
}

export function useCcts() {
  return useQuery({
    queryKey: chaves.ccts,
    queryFn: async () => {
      const vig = (await ok(supabase.from("parametros").select("data_base_vigente").single()))
        .data_base_vigente;
      const [ccts, sal, emp] = await Promise.all([
        todas((de, ate) =>
          supabase.from("ccts").select("*").order("nome").order("id").range(de, ate),
        ),
        todas((de, ate) =>
          supabase
            .from("cct_salarios")
            .select("cct_id, valor")
            .eq("funcao_id", "ped")
            .order("cct_id")
            .range(de, ate),
        ),
        ok(
          supabase
            .from("data_base_salarios")
            .select("valor")
            .eq("ano", vig ?? 0)
            .eq("funcao_id", "ped")
            .maybeSingle(),
        ),
      ]);
      const ped = new Map(sal.map((s) => [s.cct_id, Number(s.valor)]));
      const daEmpresa = emp ? Number(emp.valor) : undefined;
      // Sem salário de oficial na CCT vale o da empresa (decisão M2).
      return ccts.map((c) => ({ ...c, salarioOficial: ped.get(c.id) ?? daEmpresa }));
    },
  });
}
export type CctResumo = NonNullable<ReturnType<typeof useCcts>["data"]>[number];

/** Salários, gratificações e benefícios de uma CCT (usado pelo editor e pela comparação). */
export const carregarCct = (id: string) => carregarCctDe(supabase, id);

export const consultaCct = (id: string) => ({
  queryKey: chaves.cct(id),
  queryFn: () => carregarCct(id),
});

export function useCct(id: string | undefined) {
  return useQuery({ ...consultaCct(id ?? ""), enabled: !!id });
}

export function useCidades() {
  return useQuery({
    queryKey: chaves.cidades,
    queryFn: () => carregarCidades(supabase),
  });
}

/** Nome curto da CCT, sem o prefixo comum "Construção civil · ". */
export const nomeCurtoCct = (nome: string) => nome.replace(/^Construção civil · /, "");

// ── convenções ───────────────────────────────────────────────────────────────

const recCcts = [chaves.ccts, chaves.todasCcts, chaves.cidades] as const;

export function useAtualizarCct() {
  return useGravar(
    ({ id, patch }: { id: string; patch: T["ccts"]["Update"] }) =>
      okLinhas(supabase.from("ccts").update(patch).eq("id", id).select()),
    recCcts,
    "Salvo",
    { "23505": "Já existe uma convenção com esse nome. Use outro." },
  );
}

export function useGravarValorCct(tabela: "cct_salarios" | "cct_gratificacoes") {
  return useGravar(
    ({ cct_id, funcao_id, valor }: { cct_id: string; funcao_id: string; valor: number }) =>
      ok(supabase.from(tabela).upsert({ cct_id, funcao_id, valor }).select()),
    recCcts,
  );
}

export function useGravarBeneficioCct() {
  return useGravar(
    ({ cct_id, beneficio_id, valor }: { cct_id: string; beneficio_id: string; valor: number }) =>
      ok(supabase.from("cct_beneficios").upsert({ cct_id, beneficio_id, valor }).select()),
    recCcts,
  );
}

export function useCriarCct() {
  return useGravar(
    (a: { id: string; nome: string }) =>
      ok(supabase.rpc("criar_cct", { p_id: a.id, p_nome: a.nome })),
    recCcts,
    "Convenção criada com a tabela da empresa vigente. Ajuste nome e salários.",
    { "23505": "Já existe uma convenção com esse nome. Use outro." },
  );
}

export function useDuplicarCct() {
  return useGravar(
    (a: { origem: string; id: string; nome: string }) =>
      ok(supabase.rpc("duplicar_cct", { p_origem: a.origem, p_id: a.id, p_nome: a.nome })),
    recCcts,
    "Convenção duplicada (sem as cidades).",
    { "23505": "Já existe uma convenção com esse nome. Renomeie a cópia anterior." },
  );
}

export function useAjustarCct() {
  return useGravar(
    (a: { id: string; pct: number }) =>
      ok(supabase.rpc("ajustar_cct", { p_cct: a.id, p_pct: a.pct })),
    recCcts,
    "", // a tela avisa com o nome da CCT e o percentual
  );
}

export function useExcluirCct() {
  return useGravar(
    (id: string) => okLinhas(supabase.from("ccts").delete().eq("id", id).select()),
    recCcts,
    "Convenção excluída",
    { "23503": "A convenção tem cidades vinculadas. Mude a convenção delas antes de excluir." },
  );
}

// ── cidades ──────────────────────────────────────────────────────────────────

const recCidades = [chaves.cidades, chaves.ccts] as const;

export function useAtualizarCidade() {
  return useGravar(
    ({ id, patch }: { id: string; patch: T["cidades"]["Update"] }) =>
      okLinhas(supabase.from("cidades").update(patch).eq("id", id).select()),
    recCidades,
    "Salvo",
    { "23505": "Essa cidade já está cadastrada nessa UF." },
  );
}

export function useCriarCidade() {
  return useGravar(
    (c: T["cidades"]["Insert"]) => ok(supabase.from("cidades").insert(c).select()),
    recCidades,
    "Cidade adicionada",
    { "23505": "Essa cidade já está cadastrada nessa UF." },
  );
}

export function useGravarPassagem() {
  return useGravar(
    async ({
      cidade_id,
      origem_id,
      valor,
    }: {
      cidade_id: string;
      origem_id: string;
      valor: number;
    }) =>
      valor > 0
        ? ok(supabase.from("cidade_passagens").upsert({ cidade_id, origem_id, valor }).select())
        : ok(
            supabase
              .from("cidade_passagens")
              .delete()
              .eq("cidade_id", cidade_id)
              .eq("origem_id", origem_id)
              .select(),
          ),
    recCidades,
  );
}

export function useAdicionarFeriadoCidade() {
  return useGravar(
    (f: { cidade_id: string; mes: number; dia: number; nome: string }) =>
      ok(supabase.from("cidade_feriados").insert(f).select()),
    recCidades,
    "Feriado municipal adicionado",
    {
      "23505": "Essa cidade já tem feriado nesse dia.",
      "22008": "Essa data não existe. Informe dia/mês (dd/mm) válido.",
    },
  );
}

export function useRemoverFeriadoCidade() {
  return useGravar(
    (f: { cidade_id: string; mes: number; dia: number }) =>
      okLinhas(
        supabase
          .from("cidade_feriados")
          .delete()
          .eq("cidade_id", f.cidade_id)
          .eq("mes", f.mes)
          .eq("dia", f.dia)
          .select(),
      ),
    recCidades,
    "Feriado removido",
  );
}
