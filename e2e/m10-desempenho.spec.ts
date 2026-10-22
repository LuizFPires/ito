import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { entrar, semRolagemLateral } from "./ajuda";

// Metas do PRD §5 com volume: 1.000 obras, 100 CCTs e 500 cidades (pnpm desempenho gerar).
// Fora da suíte normal: ITO_DESEMPENHO=1 pnpm e2e e2e/m10-desempenho.spec.ts
test.skip(process.env.ITO_DESEMPENHO !== "1", "rode com ITO_DESEMPENHO=1 depois de gerar os dados");

/** Mede o tempo até a condição ficar verdadeira e registra no relatório do teste. */
async function medir(nome: string, limiteMs: number, passo: () => Promise<void>) {
  const t0 = Date.now();
  await passo();
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: "tempo", description: `${nome}: ${ms} ms` });
  console.info(`${nome}: ${ms} ms (meta ${limiteMs} ms)`);
  expect(ms, nome).toBeLessThan(limiteMs);
}

const total = (page: Page, nome: string) =>
  page.getByRole("navigation", { name: `Páginas de ${nome}` });

test("base histórica com 1.000 obras abre, filtra e pagina sem travar", async ({ page }) => {
  await entrar(page, "diretoria@ito.local");
  await medir("base: abrir com 1.000 obras", 4000, async () => {
    await page.goto("/base");
    await expect(total(page, "obras")).toContainText(/de 1\.\d{3} obras/);
  });
  await medir("base: filtrar", 1000, async () => {
    await page.getByLabel("Filtrar obras").fill("Obra Desempenho 77");
    await expect(total(page, "obras")).toContainText(/de \d{1,2} obras/);
  });
  await page.getByLabel("Filtrar obras").fill("");
  await medir("base: próxima página", 1000, async () => {
    await page.getByRole("button", { name: "Próxima ›" }).click();
    await expect(total(page, "obras")).toContainText(/^26–50/);
  });
  expect(await semRolagemLateral(page)).toBe(true);
});

test("detalhe de uma obra longa abre rápido", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await medir("obra: abrir detalhe", 3000, async () => {
    await page.goto("/obras/perf_0001");
    await expect(page.getByRole("tablist", { name: "Abas da obra" })).toBeVisible();
  });
});

test("cidades e CCTs com 500 cidades e 100 convenções", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  await medir("CCTs: abrir com 100 convenções", 3000, async () => {
    await page.goto("/cidades");
    await expect(page.getByRole("button", { name: /Convenções \(1\d{2}\)/ })).toBeVisible();
  });
  await medir("cidades: abrir a aba com 500 cidades", 2000, async () => {
    await page.getByRole("button", { name: /Cidades \(\d{3}\)/ }).click();
    await expect(total(page, "cidades")).toContainText(/de \d{3} cidades/);
  });
  await medir("cidades: buscar", 1000, async () => {
    await page.getByLabel("Buscar cidade").fill("Desempenho 300");
    await expect(total(page, "cidades")).toContainText(/de 1 cidades/);
  });
  expect(await semRolagemLateral(page)).toBe(true);
});
