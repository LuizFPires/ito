import { useCallback, useState } from "react";

const CHAVE = "ito.menu-recolhido";

/** Menu lateral recolhido (só ícones), lembrado neste navegador como o tema. */
export function useMenuRecolhido() {
  const [recolhido, setEstado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) === "1";
    } catch {
      return false;
    }
  });
  const alternar = useCallback(() => {
    setEstado((r) => {
      try {
        if (r) localStorage.removeItem(CHAVE);
        else localStorage.setItem(CHAVE, "1");
      } catch {
        /* armazenamento indisponível: vale só nesta sessão */
      }
      return !r;
    });
  }, []);
  return { recolhido, alternar };
}
