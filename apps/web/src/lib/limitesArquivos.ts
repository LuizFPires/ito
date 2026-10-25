/**
 * Limites dos arquivos da carga (M13 · S07), conferidos antes de ler: um arquivo enorme trava o
 * navegador de quem carrega. Folga ampla sobre o maior arquivo real (≈ 18 MB, 600 lançamentos).
 */
import { numero } from "@ito/formato";

export const LIMITES_ARQUIVO = {
  /** planilha (.xlsx/.csv) da folha, ponto, VT ou ERP */
  planilhaBytes: 50 * 1024 * 1024,
  /** abas de uma planilha */
  abas: 30,
  /** cada XML de nota fiscal */
  xmlBytes: 2 * 1024 * 1024,
  /** notas fiscais de um envio */
  xmls: 2000,
};

const mb = (b: number) => `${numero(b / 1024 / 1024)} MB`;

/** Mensagem para quem carrega, ou null quando os arquivos cabem. */
export function foraDoLimite(
  tipo: string,
  arquivos: readonly { name: string; size: number }[],
): string | null {
  if (tipo === "nf") {
    if (arquivos.length > LIMITES_ARQUIVO.xmls)
      return `Envie até ${numero(LIMITES_ARQUIVO.xmls)} notas por vez (vieram ${numero(arquivos.length)}).`;
    const grande = arquivos.find((a) => a.size > LIMITES_ARQUIVO.xmlBytes);
    return grande
      ? `“${grande.name}” passa de ${mb(LIMITES_ARQUIVO.xmlBytes)}: confira se é o XML da nota.`
      : null;
  }
  const a = arquivos[0];
  return a && a.size > LIMITES_ARQUIVO.planilhaBytes
    ? `“${a.name}” passa de ${mb(LIMITES_ARQUIVO.planilhaBytes)}: divida o arquivo por período e carregue um de cada vez.`
    : null;
}
