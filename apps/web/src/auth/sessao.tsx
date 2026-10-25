import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { limparSelecao } from "../lib/selecao";
import type { Usuario } from "../lib/supabase";
import { nivelDaSessao, precisaDeMfa } from "./mfa";

interface SessaoCtx {
  /** undefined = ainda carregando; null = sem login */
  sessao: Session | null | undefined;
  usuario: Usuario | null | undefined;
  /** A conta existe no Auth, mas o cadastro em `usuarios` não pôde ser lido. */
  erroUsuario: boolean;
  /** M13: a conta precisa do segundo fator e a sessão ainda não tem (AAL1). */
  faltaMfa: boolean;
  /** Devolve false quando não deu para encerrar a sessão (ex.: sem rede). */
  sair: () => Promise<boolean>;
}

const Ctx = createContext<SessaoCtx>({
  sessao: undefined,
  usuario: undefined,
  erroUsuario: false,
  faltaMfa: false,
  sair: async () => true,
});

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setSessao(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      // Em computador compartilhado, nada do usuário anterior fica no cache.
      if (evento === "SIGNED_OUT") queryClient.clear();
      // M13: o que foi lido em AAL1 veio vazio (RLS); com o código confirmado, lê de novo
      if (evento === "MFA_CHALLENGE_VERIFIED") void queryClient.invalidateQueries();
      setSessao(s);
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const uid = sessao?.user.id;
  const { data: usuario, isError } = useQuery({
    queryKey: ["usuario", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("*").eq("id", uid!).single();
      if (error) throw error;
      return data;
    },
  });

  const valor: SessaoCtx = {
    sessao,
    usuario: sessao === null ? null : usuario,
    erroUsuario: !!uid && isError,
    faltaMfa: !!sessao && precisaDeMfa(usuario) && nivelDaSessao(sessao) !== "aal2",
    sair: async () => {
      limparSelecao();
      const { error } = await supabase.auth.signOut();
      if (!error) return true;
      // Sem rede: encerra ao menos neste navegador.
      const local = await supabase.auth.signOut({ scope: "local" });
      return !local.error;
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao() {
  return useContext(Ctx);
}
