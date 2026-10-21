import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { Usuario } from "../lib/supabase";

interface SessaoCtx {
  /** undefined = ainda carregando; null = sem login */
  sessao: Session | null | undefined;
  usuario: Usuario | null | undefined;
  sair: () => Promise<void>;
}

const Ctx = createContext<SessaoCtx>({
  sessao: undefined,
  usuario: undefined,
  sair: async () => {},
});

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setSessao(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const uid = sessao?.user.id;
  const { data: usuario } = useQuery({
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
    sair: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao() {
  return useContext(Ctx);
}
