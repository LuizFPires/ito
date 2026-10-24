/**
 * Depois de uma publicação, a aba aberta ainda pede os arquivos da versão anterior (que não existem
 * mais): recarrega uma vez para buscar a versão nova, em vez de mostrar o erro.
 */
export const ehVersaoVelha = (e: unknown) =>
  /dynamically imported module|importing a module script failed|unable to preload css/i.test(
    String((e as { message?: unknown } | null)?.message ?? e),
  );

const CHAVE = "ito.recarregou-versao";

/** Recarrega a página, no máximo uma vez a cada 10 s (sem laço se o erro for outro). */
export function recarregarUmaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < 10_000) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // sem armazenamento: recarrega mesmo assim (o navegador limita o laço pelo erro seguinte)
  }
  window.location.reload();
  return true;
}
