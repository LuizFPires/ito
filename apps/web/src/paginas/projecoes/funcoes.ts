import { useCallback } from "react";
import type { Contexto } from "@ito/motor";
import { useFuncoes } from "../../dados/cadastros";

export interface InfoFuncao {
  id: string;
  nome: string;
  cor: string;
  estagio: boolean;
}

/** Nome e cor de cada função (cadastro), em ordem de nome nas tabelas. */
export function useInfoFuncoes(_ctx?: Contexto) {
  const q = useFuncoes();
  const lista = q.data;
  const fun = useCallback(
    (id: string): InfoFuncao => {
      const x = lista?.find((f) => f.id === id);
      return {
        id,
        nome: x?.nome ?? id,
        cor: `var(--${x?.cor ?? "i4"})`,
        estagio: x?.vinculo === "estagio",
      };
    },
    [lista],
  );
  const ordenarFuncoes = useCallback(
    (ids: readonly string[]) =>
      [...ids].sort((a, b) => fun(a).nome.localeCompare(fun(b).nome, "pt-BR")),
    [fun],
  );
  return { fun, ordenarFuncoes };
}
