import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useSessao } from "./sessao";

/** Só entra com sessão; sem login, vai para /entrar e volta para onde estava. */
export function Protegida({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const local = useLocation();
  if (sessao === undefined)
    return (
      <p className="sub" style={{ padding: 24 }}>
        Carregando…
      </p>
    );
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}
