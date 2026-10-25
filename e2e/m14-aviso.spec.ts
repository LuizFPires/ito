import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

// M14: sair do assistente com mudança não salva pede confirmação
test("projeção com mudança não salva avisa antes de sair", async ({ page }) => {
  await entrar(page, "planejamento@ito.local");
  await page.goto("/projecoes/nova");
  await page.getByRole("textbox", { name: "Nome da projeção" }).fill("Aviso ao sair");
  const mensagens: string[] = [];
  page.once("dialog", (d) => {
    mensagens.push(d.message());
    void d.dismiss();
  });
  await page
    .getByRole("navigation", { name: "Menu" })
    .getByRole("link", { name: "Base histórica" })
    .click();
  await expect(page).toHaveURL(/\/projecoes\/nova$/);
  expect(mensagens[0]).toContain("mudanças que não foram salvas");
  page.once("dialog", (d) => void d.accept());
  await page
    .getByRole("navigation", { name: "Menu" })
    .getByRole("link", { name: "Base histórica" })
    .click();
  await expect(page).toHaveURL(/\/base$/);
});
