import type { Tabela } from "../lib/planilha";
import { textoDaTabela } from "../lib/planilha";
import { Botao } from "./componentes";
import { useToast } from "./toast";

/** "Copiar para Excel": a tabela da tela como texto tabulado BR na área de transferência. */
export function BotaoCopiar({ tabela }: { tabela: () => Tabela }) {
  const avisar = useToast();
  return (
    <Botao
      pequeno
      onClick={() =>
        navigator.clipboard.writeText(textoDaTabela(tabela())).then(
          () => avisar("Tabela copiada. Cole no Excel."),
          () => avisar("Não foi possível copiar. Permita o acesso à área de transferência."),
        )
      }
    >
      Copiar para Excel
    </Botao>
  );
}
