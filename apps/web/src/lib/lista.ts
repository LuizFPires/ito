import { normalizar } from "../shell/rotas";

/** Filtro, ordenação e paginação das listas de cadastro (regra 7 do CLAUDE.md). */

export type Direcao = 1 | -1;

export interface Ordem<K extends string> {
  chave: K;
  dir: Direcao;
}

export function contemTermos(alvo: string, q: string): boolean {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  const t = normalizar(alvo);
  return termos.every((x) => t.includes(x));
}

export function ordenar<T, K extends string>(
  itens: readonly T[],
  ordem: Ordem<K>,
  valor: (item: T, chave: K) => string | number,
): T[] {
  return [...itens].sort((a, b) => {
    const x = valor(a, ordem.chave);
    const y = valor(b, ordem.chave);
    const c =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt-BR", { sensitivity: "base", numeric: true });
    return c * ordem.dir;
  });
}

export interface Pagina<T> {
  itens: T[];
  pagina: number;
  paginas: number;
  total: number;
  de: number;
  ate: number;
}

/** `pagina` começa em 1 e é ajustada para o intervalo válido. */
export function paginar<T>(itens: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const total = itens.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const p = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  const ini = (p - 1) * porPagina;
  const fatia = itens.slice(ini, ini + porPagina);
  return {
    itens: fatia,
    pagina: p,
    paginas,
    total,
    de: total ? ini + 1 : 0,
    ate: ini + fatia.length,
  };
}

export function alternarOrdem<K extends string>(atual: Ordem<K>, chave: K): Ordem<K> {
  return atual.chave === chave ? { chave, dir: (atual.dir * -1) as Direcao } : { chave, dir: 1 };
}

/** Código de cadastro a partir do nome: "Operador de betoneira" → "operador_de_betoneira". */
export function codigoDe(nome: string): string {
  const base = normalizar(nome)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .replace(/_+$/, "");
  return /^[a-z]/.test(base) ? base : `f_${base}`.slice(0, 32);
}
