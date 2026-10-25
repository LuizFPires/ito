import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { SegundoFator } from "./SegundoFator";
import { useSessao } from "./sessao";

/** Só entra com sessão; sem login, vai para /entrar e volta para onde estava. */
export function Protegida({ children }: { children: ReactNode }) {
  const { sessao, faltaMfa } = useSessao();
  const local = useLocation();
  if (sessao === undefined)
    return (
      <p className="sub" style={{ padding: 24 }}>
        Carregando…
      </p>
    );
  if (!sessao)
    return (
      <Navigate to="/entrar" replace state={{ de: local.pathname + local.search + local.hash }} />
    );
  // M13: conta que administra ou aprova só entra com o código do aplicativo autenticador
  if (faltaMfa) return <SegundoFator />;
  return <>{children}</>;
}
