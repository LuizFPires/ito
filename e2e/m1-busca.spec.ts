import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

test("busca global acha função por sinônimo da folha e abre o detalhe", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.keyboard.press("Control+k");
  const busca = page.getByRole("combobox", { name: "Buscar no ITO" });
  await busca.fill("ajudante geral");
  await expect(page.getByRole("option", { name: /Servente.*Função padrão/ })).toBeVisible();
  await busca.press("Enter");
  await expect(page).toHaveURL(/\/funcoes$/);
  await expect(page.getByRole("region", { name: "Função Servente" })).toBeVisible();

  // De dentro da própria tela, outra busca troca a função aberta.
  await busca.fill("vigia");
  await page.getByRole("option", { name: /Vigia.*Função padrão/ }).click();
  await expect(page.getByRole("region", { name: "Função Vigia" })).toBeVisible();
});

test("busca global acha rubrica pelo código e filtra a lista", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  const busca = page.getByRole("combobox", { name: "Buscar no ITO" });
  await busca.fill("2126");
  await page.getByRole("option", { name: /2126 · PRÊMIO/ }).click();
  await expect(page).toHaveURL(/\/rubricas$/);
  await expect(page.getByRole("searchbox", { name: "Buscar rubrica" })).toHaveValue("2126 PRÊMIO");
  await expect(page.getByRole("row")).toHaveCount(2);
});

test("rubrica 1 na busca mostra só ela, não todas as que têm 1 no código", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  const busca = page.getByRole("combobox", { name: "Buscar no ITO" });
  await busca.fill("horas normais");
  await page.getByRole("option", { name: /^1 · HORAS NORMAIS/ }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
});
