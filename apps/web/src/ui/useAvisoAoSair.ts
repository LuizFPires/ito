import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useBlocker } from "react-router";

/**
 * M14: edição não se perde. Com `sujo`, sair para outra tela pede confirmação, e fechar ou
 * recarregar a aba mostra o aviso do navegador. Depois de salvar, chame `liberar()` antes de
 * navegar.
 */
export function useAvisoAoSair(sujo: boolean, mensagem: string) {
  const livre = useRef(false);
  // o roteador guarda a função de bloqueio de um render anterior: o estado vem por ref, para um
  // clique logo depois de digitar já valer como mudança
  const sujoAgora = useRef(sujo);
  useLayoutEffect(() => {
    sujoAgora.current = sujo;
  }, [sujo]);
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujoAgora.current && !livre.current && currentLocation.pathname !== nextLocation.pathname,
  );
  // uma pergunta por saída bloqueada (o efeito pode rodar de novo com o mesmo bloqueio, como no
  // StrictMode; perguntar duas vezes deixava o segundo "cancelar" desfazer o "sair")
  const perguntado = useRef<string | null>(null);
  useEffect(() => {
    if (bloqueio.state !== "blocked") {
      perguntado.current = null;
      return;
    }
    if (perguntado.current === bloqueio.location.key) return;
    perguntado.current = bloqueio.location.key;
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
