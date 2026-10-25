import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

// M14: sair do assistente com mudança não salva pede confirmação
test("projeção com mudança não salva avisa antes de sair", async ({ page }) => {
  await entrar(page, "planejamento@ito.local");
  await page.goto("/projecoes/nova");
  await page.getByRole("textbox", { name: "Nome da projeção" }).fill("Aviso ao sair");
  const base = page
    .getByRole("navigation", { name: "Menu" })
    .getByRole("link", { name: "Base histórica" });

  // recusar: fica no assistente
  const [recusado] = await Promise.all([page.waitForEvent("dialog"), base.click()]);
  expect(recusado.message()).toContain("mudanças que não foram salvas");
  await recusado.dismiss();
  await expect(page).toHaveURL(/\/projecoes\/nova$/);
  await expect(page.getByRole("textbox", { name: "Nome da projeção" })).toHaveValue(
    "Aviso ao sair",
  );

  // aceitar: sai
  const [aceito] = await Promise.all([page.waitForEvent("dialog"), base.click()]);
  await aceito.accept();
  await expect(page).toHaveURL(/\/base$/);
});
