import type { Session } from "@supabase/supabase-js";
import type { Usuario } from "../lib/supabase";

/** Nível de autenticação da sessão (aal1 = só senha; aal2 = senha + código), lido do token. */
export function nivelDaSessao(s: Session | null | undefined): string | null {
  const parte = s?.access_token.split(".")[1];
  if (!parte) return null;
  try {
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { aal?: string }).aal ?? null;
  } catch {
    return null;
  }
}

/** Administrador, controladoria e diretoria precisam do segundo fator (o banco confere). */
export const precisaDeMfa = (u: Usuario | null | undefined) =>
  !!u && !u.mfa_dispensado && (u.admin || u.perfil === "controladoria" || u.perfil === "diretoria");
