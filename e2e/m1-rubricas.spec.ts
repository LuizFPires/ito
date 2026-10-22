import { expect, test } from "@playwright/test";
import { entrar, semRolagemLateral } from "./ajuda";

test("dicionário com indicadores, filtro e sem rolagem lateral", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/rubricas");
  await expect(page.getByText(/de \d+ rubricas/)).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  await page.getByRole("searchbox", { name: "Buscar rubrica" }).fill("2003");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("row").nth(1)).toContainText("VALE TRANSPORTE 6%");

  await page.getByRole("searchbox", { name: "Buscar rubrica" }).fill("");
  await page.getByRole("button", { name: "Informativas" }).click();
  for (const linha of await page
    .getByRole("row")
    .all()
    .then((l) => l.slice(1))) {
    await expect(linha.getByLabel(/^Tipo de/)).toHaveValue("informativo");
  }
});

test("DP/RH cria e classifica uma rubrica nova", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/rubricas");
  const cod = String(70000 + (Date.now() % 20000));
  await page.getByRole("button", { name: "Nova rubrica" }).click();
  const form = page.getByRole("region", { name: "Nova rubrica" });
  await form.getByLabel("Código na folha").fill(cod);
  await form.getByLabel("Nome").fill("adicional teste e2e");
  await form.getByLabel("Entra no custo como").selectOption("extras");
  await form.getByRole("button", { name: "Criar rubrica" }).click();
  await expect(page.getByRole("status")).toContainText("Rubrica criada");

  await page.getByRole("searchbox", { name: "Buscar rubrica" }).fill(cod);
  const linha = page.getByRole("row").nth(1);
  await expect(linha).toContainText("ADICIONAL TESTE E2E");
  await linha.getByLabel(/^Componente de/).selectOption("he");
  await expect(page.getByRole("status")).toContainText("Salvo");
  await linha.getByRole("button", { name: "Inativar" }).click();
  await expect(page.getByRole("row")).toHaveCount(2); // some da lista (cabeçalho + "nenhuma")
});

test("código repetido é recusado com a ação a tomar", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/rubricas");
  await page.getByRole("button", { name: "Nova rubrica" }).click();
  const form = page.getByRole("region", { name: "Nova rubrica" });
  await form.getByLabel("Código na folha").fill("1");
  await form.getByLabel("Nome").fill("x");
  await form.getByRole("button", { name: "Criar rubrica" }).click();
  await expect(form.getByRole("alert")).toHaveText("Já existe a rubrica 1. Use outro código.");
});

test("diretoria só lê as rubricas", async ({ page }) => {
  await entrar(page, "diretoria@ito.local");
  await page.goto("/rubricas");
  await expect(page.getByRole("button", { name: "Nova rubrica" })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /é base de provisões/ }).first()).toBeDisabled();
  await expect(page.getByLabel(/^Tipo de/)).toHaveCount(0);
});
