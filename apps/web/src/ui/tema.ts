import { useCallback, useEffect, useState } from "react";

export type Tema = "sistema" | "claro" | "escuro";

const CHAVE = "ito.tema";

/** Tema salvo neste navegador (ou "sistema"). */
export function temaSalvo(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "claro" || v === "escuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

/** Aplica o tema no <html>: data-theme="light"/"dark" ou nada (segue o sistema). */
export function aplicarTema(t: Tema) {
  const el = document.documentElement;
  if (t === "sistema") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t === "escuro" ? "dark" : "light");
}

/** Tema escolhido pelo usuário, lembrado neste navegador. */
export function useTema() {
  const [tema, setTemaEstado] = useState<Tema>(temaSalvo);

  useEffect(() => aplicarTema(tema), [tema]);

  const setTema = useCallback((t: Tema) => {
    try {
      if (t === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, t);
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
    setTemaEstado(t);
  }, []);

  return { tema, setTema };
}
