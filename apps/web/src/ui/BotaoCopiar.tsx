import type { Tabela } from "../lib/planilha";
import { semFormula, textoDaTabela } from "../lib/planilha";
import { Botao } from "./componentes";
import { useToast } from "./toast";

/** Plano B (como o protótipo) quando a área de transferência não existe ou recusa. */
function copiarAntigo(texto: string): boolean {
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * "Copiar para Excel": uma ou mais tabelas da tela como texto tabulado BR na área de
 * transferência (várias tabelas separadas por uma linha em branco).
 */
export function BotaoCopiar({ tabela }: { tabela: () => Tabela | readonly Tabela[] }) {
  const avisar = useToast();
  async function copiar() {
    const t = tabela();
    const lista: readonly Tabela[] = Array.isArray(t) ? t : [t as Tabela];
    // várias tabelas: o nome de cada uma numa linha antes dela
    const texto =
      lista.length > 1
        ? lista.map((x) => `${semFormula(x.aba)}\r\n${textoDaTabela(x)}`).join("\r\n\r\n")
        : textoDaTabela(lista[0]!);
    const ok =
      (await navigator.clipboard?.writeText(texto).then(
        () => true,
        () => false,
      )) || copiarAntigo(texto);
    avisar(
      ok
        ? lista.length > 1
          ? "Tabelas copiadas. Cole no Excel."
          : "Tabela copiada. Cole no Excel."
        : "Não foi possível copiar neste navegador. Use Exportar .xlsx.",
    );
  }
  return (
    <Botao pequeno onClick={() => void copiar()}>
      Copiar para Excel
    </Botao>
  );
}
