import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/tipos-banco";
import { useToast } from "../ui/toast";
import { mensagemErroBanco } from "./erros";

type T = Database["public"]["Tables"];
export type Cct = T["ccts"]["Row"];
export type Cidade = T["cidades"]["Row"] & {
  feriados: { mes: number; dia: number; nome: string }[];
  passagens: Record<string, number>;
};
export interface DetalheCct {
  salarios: Record<string, number>;
  gratificacoes: Record<string, number>;
  beneficios: Record<string, number>;
}

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

export function useCcts() {
  return useQuery({
    queryKey: chaves.ccts,
    queryFn: async () => {
      const [ccts, sal] = await Promise.all([
        ok(supabase.from("ccts").select("*").order("nome")),
        ok(supabase.from("cct_salarios").select("cct_id, valor").eq("funcao_id", "ped")),
      ]);
      const ped = Object.fromEntries(sal.map((s) => [s.cct_id, Number(s.valor)]));
      return ccts.map((c) => ({ ...c, salarioOficial: ped[c.id] as number | undefined }));
    },
  });
}
export type CctResumo = NonNullable<ReturnType<typeof useCcts>["data"]>[number];

export function useCct(id: string | undefined) {
  return useQuery({
    queryKey: chaves.cct(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<DetalheCct> => {
      const [sal, grat, ben] = await Promise.all([
        ok(supabase.from("cct_salarios").select("funcao_id, valor").eq("cct_id", id!)),
        ok(supabase.from("cct_gratificacoes").select("funcao_id, valor").eq("cct_id", id!)),
        ok(supabase.from("cct_beneficios").select("beneficio_id, valor").eq("cct_id", id!)),
      ]);
      return {
        salarios: Object.fromEntries(sal.map((r) => [r.funcao_id, Number(r.valor)])),
        gratificacoes: Object.fromEntries(grat.map((r) => [r.funcao_id, Number(r.valor)])),
        beneficios: Object.fromEntries(ben.map((r) => [r.beneficio_id, Number(r.valor)])),
      };
    },
  });
}

export function useCidades() {
  return useQuery({
    queryKey: chaves.cidades,
    queryFn: async (): Promise<Cidade[]> => {
      const [cidades, fer, pas] = await Promise.all([
        ok(supabase.from("cidades").select("*").order("nome")),
        ok(supabase.from("cidade_feriados").select("*").order("mes").order("dia")),
        ok(supabase.from("cidade_passagens").select("*")),
      ]);
      return cidades.map((c) => ({
        ...c,
        feriados: fer
          .filter((f) => f.cidade_id === c.id)
          .map((f) => ({ mes: f.mes, dia: f.dia, nome: f.nome })),
        passagens: Object.fromEntries(
          pas.filter((p) => p.cidade_id === c.id).map((p) => [p.origem_id, Number(p.valor)]),
        ),
      }));
    },
  });
}

export const nomeCidade = (c: { nome: string; uf: string }) => `${c.nome}/${c.uf}`;
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
    "Salários e gratificações ajustados",
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
