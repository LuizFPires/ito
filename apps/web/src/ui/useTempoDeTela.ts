import { useEffect, useRef } from "react";
import { medirTempo } from "../lib/metricas";

/**
 * M14: mede quanto uma parte da tela leva para ficar pronta — de quando `aberto` vira verdadeiro
 * até `pronto` (com o quadro já pintado). Uma medida por abertura.
 */
export function useTempoDeTela(nome: string, aberto: boolean, pronto: boolean) {
  const inicio = useRef<number | null>(null);
  useEffect(() => {
    inicio.current = aberto ? performance.now() : null;
  }, [aberto]);
  useEffect(() => {
    if (!aberto || !pronto || inicio.current === null) return;
    const t0 = inicio.current;
    inicio.current = null;
    // dois quadros: o primeiro aplica o DOM, o segundo já foi pintado
    requestAnimationFrame(() =>
      requestAnimationFrame(() => medirTempo(nome, performance.now() - t0)),
    );
  }, [nome, aberto, pronto]);
}
