import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const SENHA = "ito-dev-2026";

/** Entra com um usuário do seed e espera o shell carregar. */
export async function entrar(page: Page, email = "planejamento@ito.local") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/base$/);
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
}

export async function semRolagemLateral(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}
