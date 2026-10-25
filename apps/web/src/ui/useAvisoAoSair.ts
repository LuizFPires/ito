import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router";

/**
 * M14: edição não se perde. Com `sujo`, sair para outra tela pede confirmação, e fechar ou
 * recarregar a aba mostra o aviso do navegador. Depois de salvar, chame `liberar()` antes de
 * navegar.
 */
export function useAvisoAoSair(sujo: boolean, mensagem: string) {
  const livre = useRef(false);
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && !livre.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (bloqueio.state !== "blocked") return;
    if (window.confirm(mensagem)) bloqueio.proceed();
    else bloqueio.reset();
  }, [bloqueio, mensagem]);
  useEffect(() => {
    if (!sujo) return;
    const antes = (ev: BeforeUnloadEvent) => {
      if (livre.current) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    addEventListener("beforeunload", antes);
    return () => removeEventListener("beforeunload", antes);
  }, [sujo]);
  return useCallback(() => {
    livre.current = true;
  }, []);
}
