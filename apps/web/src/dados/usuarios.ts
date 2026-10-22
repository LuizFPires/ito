/**
 * Usuários (M10, só admin): lista com o último acesso, tabela de permissões do banco, convite,
 * troca de perfil e admin, desativar e reativar. Convite e situação passam pela Edge Function
 * `usuarios` (a chave de serviço fica no servidor); perfil e admin, pela RLS de usuarios.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Perfil } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import { useToast } from "../ui/toast";
import { mensagemErroBanco } from "./erros";

export interface UsuarioLista {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil;
  admin: boolean;
  ativo: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
  convite_pendente: boolean;
}

export interface Permissao {
  ordem: number;
  modulo: string;
  limitacao: string | null;
  perfil: Perfil | null;
  admin: boolean;
  le: boolean;
  edita: boolean;
  aprova: boolean;
  so_totais: boolean;
}

export function useUsuarios(ativo: boolean) {
  return useQuery({
    queryKey: ["usuarios"],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_usuarios");
      if (error) throw error;
      return (data ?? []) as UsuarioLista[];
    },
  });
}

export function usePermissoes() {
  return useQuery({
    queryKey: ["permissoes"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("permissoes");
      if (error) throw error;
      return (data ?? []) as Permissao[];
    },
  });
}

/** Erro da Edge Function vem em { erro }; sem ele, uma mensagem genérica que diz o que fazer. */
async function funcao(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("usuarios", { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = "Não foi possível falar com o servidor. Tente de novo.";
    try {
      const j = (await ctx?.json()) as { erro?: string } | undefined;
      if (j?.erro) msg = j.erro;
    } catch {
      /* resposta sem JSON: fica a mensagem genérica */
    }
    throw new Error(msg);
  }
  return data as { id: string };
}

function useAcao<A>(fn: (a: A) => Promise<unknown>, ok: string) {
  const qc = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      avisar(ok);
      return qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: unknown) => avisar(e instanceof Error ? e.message : mensagemErroBanco(e)),
  });
}

export interface Convite {
  email: string;
  nome: string;
  perfil: Perfil;
  admin: boolean;
}

export const useConvidar = () =>
  useAcao((c: Convite) => funcao({ acao: "convidar", ...c }), "Convite enviado");

export const useSituacao = () =>
  useAcao(
    ({ id, ativo }: { id: string; ativo: boolean }) =>
      funcao({ acao: ativo ? "reativar" : "desativar", id }),
    "Salvo",
  );

export const useLinkSenha = () =>
  useAcao((id: string) => funcao({ acao: "link_senha", id }), "Link enviado por e-mail");

export const useAlterarUsuario = () =>
  useAcao(async ({ id, patch }: { id: string; patch: { perfil?: Perfil; admin?: boolean } }) => {
    const { data, error } = await supabase.from("usuarios").update(patch).eq("id", id).select("id");
    // as proteções do gatilho (próprio admin, último admin) já dizem o que fazer
    if (error) throw new Error(error.code === "P0001" ? error.message : mensagemErroBanco(error));
    if (!data?.length) throw new Error("Só um administrador altera usuários. Atualize a página.");
  }, "Salvo");
