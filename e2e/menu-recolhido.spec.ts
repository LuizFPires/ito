import { expect, test } from "@playwright/test";
import { entrar, semRolagemLateral } from "./ajuda";

// Menu lateral recolhível: recolhido mostra só os ícones, que continuam levando às telas; a
// escolha fica lembrada no navegador; o conteúdo usa a largura que sobra.
test("menu recolhido: só ícones, clicáveis, e a escolha fica lembrada", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  const menu = page.getByRole("navigation", { name: "Menu" });
  const principal = page.locator("main");
  const larguraAberto = (await principal.boundingBox())!.width;

  await menu.getByRole("button", { name: "Recolher menu" }).click();
  await expect(menu.getByRole("button", { name: "Expandir menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  // o nome sai da tela, mas o link continua com nome acessível e dica ao passar o mouse
  const projecoes = menu.getByRole("link", { name: "Projeções" });
  await expect(projecoes).toHaveAttribute("title", "Projeções");
  await expect.poll(async () => (await menu.boundingBox())!.width).toBeLessThan(90);
  await expect
    .poll(async () => (await principal.boundingBox())!.width)
    .toBeGreaterThan(larguraAberto + 120);

  // acessa a tela pelo ícone, sem expandir
  await projecoes.click();
  await expect(page.getByRole("heading", { level: 1, name: "Projeções" })).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  // lembrado depois de recarregar; expandir volta os nomes
  await page.reload();
  await expect(menu.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await menu.getByRole("button", { name: "Expandir menu" }).click();
  await expect(menu.getByText("Base histórica")).toBeVisible();
  await expect(menu.getByRole("link", { name: "Projeções" })).not.toHaveAttribute("title");
});
