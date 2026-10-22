import { useCallback } from "react";
import type { Contexto, GrupoFuncao } from "@ito/motor";
import { useFuncoes } from "../../dados/cadastros";
import { ORDEM_GRUPOS } from "../obra/comum";

export interface InfoFuncao {
  id: string;
  nome: string;
  grupo: GrupoFuncao;
  cor: string;
  estagio: boolean;
}

/** Nome, cor e grupo de cada função (cadastro), com a ordem de grupo e nome das tabelas. */
export function useInfoFuncoes(ctx: Contexto | undefined) {
  const q = useFuncoes();
  const lista = q.data;
  const fun = useCallback(
    (id: string): InfoFuncao => {
      const x = lista?.find((f) => f.id === id);
      const m = ctx?.funcoes.find((f) => f.id === id);
      return {
        id,
        nome: x?.nome ?? id,
        grupo: x?.grupo ?? m?.grupo ?? "direta",
        cor: `var(--${x?.cor ?? "i4"})`,
        estagio: x?.vinculo === "estagio",
      };
    },
    [lista, ctx],
  );
  const ordenarFuncoes = useCallback(
    (ids: readonly string[]) =>
      [...ids].sort(
        (a, b) =>
          ORDEM_GRUPOS.indexOf(fun(a).grupo) - ORDEM_GRUPOS.indexOf(fun(b).grupo) ||
          fun(a).nome.localeCompare(fun(b).nome, "pt-BR"),
      ),
    [fun],
  );
  return { fun, ordenarFuncoes };
}
