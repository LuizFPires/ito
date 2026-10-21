/**
 * Obras selecionadas para comparar ou projetar (decisão M6): compartilhadas entre a base, o
 * detalhe da obra e a comparação, na sessão do navegador (por aba). Sem armazenamento, fica só
 * na memória.
 */
import { useSyncExternalStore } from "react";

const CHAVE = "ito.selecao.obras";
export const MAX_COMPARAR = 4;
const ouvintes = new Set<() => void>();
let memoria: string[] = ler();

function ler(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function definirSelecao(ids: readonly string[]) {
  memoria = [...new Set(ids)];
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(memoria));
  } catch {
    // sem armazenamento: segue na memória
  }
  for (const f of ouvintes) f();
}

/** Junta obras à seleção (sem repetir), na ordem em que chegam. */
export const juntarASelecao = (ids: readonly string[]) => definirSelecao([...memoria, ...ids]);

export function useSelecaoObras(): [string[], (ids: readonly string[]) => void] {
  const sel = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => memoria,
  );
  return [sel, definirSelecao];
}
