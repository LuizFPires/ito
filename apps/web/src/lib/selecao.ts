/**
 * Obras selecionadas para comparar ou projetar (decisão M6): compartilhadas entre a base, o
 * detalhe da obra e a comparação, na sessão do navegador (por aba). Sem armazenamento, fica só
 * na memória. Limpa ao sair (outro usuário na mesma aba não herda).
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

/**
 * "Comparar com…" na obra (protótipo `cmpobra`): a obra vai para a frente, para sempre aparecer
 * entre as 4 que a comparação mostra (as demais continuam selecionadas).
 */
export const compararCom = (id: string) => definirSelecao([id, ...memoria.filter((x) => x !== id)]);

export const limparSelecao = () => definirSelecao([]);

const inscrever = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
const instantaneo = () => memoria;

export function useSelecaoObras(): [string[], (ids: readonly string[]) => void] {
  return [useSyncExternalStore(inscrever, instantaneo), definirSelecao];
}
