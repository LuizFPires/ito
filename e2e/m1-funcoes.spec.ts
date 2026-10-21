import { expect, test } from "@playwright/test";
import { entrar, semRolagemLateral } from "./ajuda";

test("lista as 14 funções com busca por sinônimo, sem rolagem lateral", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/funcoes");
  await expect(page.getByText(/1–1\d de 1\d funções/)).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  await page.getByRole("searchbox", { name: "Buscar função" }).fill("meio oficial");
  await expect(page.getByRole("row")).toHaveCount(2); // cabeçalho + Pedreiro
  await expect(page.getByRole("row").nth(1)).toContainText("Pedreiro");
  await expect(page.getByRole("row").nth(1)).toContainText("R$ 1.400,00");
});

test("engenharia só lê: sem 'Nova função' e campos travados", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/funcoes");
  await expect(page.getByRole("button", { name: "Nova função" })).toHaveCount(0);
  await page.getByRole("button", { name: "Pedreiro", exact: true }).click();
  const painel = page.getByRole("region", { name: "Função Pedreiro" });
  await expect(painel.getByLabel("Nome")).toBeDisabled();
  await expect(painel.getByLabel("Ferramentas (R$/mês)")).toBeDisabled();
});

test("DP/RH edita ferramentas e sinônimos de uma função", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/funcoes");
  await page.getByRole("button", { name: "Armador", exact: true }).click();
  const painel = page.getByRole("region", { name: "Função Armador" });

  const ferr = painel.getByLabel("Ferramentas (R$/mês)");
  await ferr.fill("1.234,5");
  await ferr.press("Enter");
  await expect(page.getByRole("status")).toContainText("Salvo");
  await page.reload();
  await page.getByRole("button", { name: "Armador", exact: true }).click();
  await expect(painel.getByLabel("Ferramentas (R$/mês)")).toHaveValue("1.234,50");
  await painel.getByLabel("Ferramentas (R$/mês)").fill("60");
  await painel.getByLabel("Ferramentas (R$/mês)").press("Enter");

  const sin = `ARMADOR TESTE ${Date.now()}`;
  await painel.getByLabel("Novo sinônimo").fill(sin.toLowerCase());
  await painel.getByRole("button", { name: "Adicionar" }).click();
  await expect(painel.getByText(sin)).toBeVisible();
  await painel.getByRole("button", { name: `Remover sinônimo ${sin}` }).click();
  await expect(painel.getByText(sin)).toHaveCount(0);
});

test("valor inválido mostra o que fazer e não salva", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/funcoes");
  await page.getByRole("button", { name: "Vigia", exact: true }).click();
  const campo = page.getByRole("region", { name: "Função Vigia" }).getByLabel("Periculosidade (%)");
  await campo.fill("150");
  await campo.press("Enter");
  await expect(page.getByText("Informe um valor entre 0,00 e 100,00.")).toBeVisible();
});

test("DP/RH cria uma função nova", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/funcoes");
  const nome = `Operador teste ${Date.now()}`;
  await page.getByRole("button", { name: "Nova função" }).click();
  const painel = page.getByRole("region", { name: "Nova função" });
  await painel.getByLabel("Nome").fill(nome);
  await painel.getByLabel("Grupo").selectOption("indireta");
  await painel.getByRole("button", { name: "Criar função" }).click();
  await expect(page.getByRole("status")).toContainText("Função criada");
  await expect(page.getByRole("region", { name: `Função ${nome}` })).toBeVisible();
  // padrões do protótipo: salário de oficial e conta 04.03.99
  await expect(page.getByRole("region", { name: `Função ${nome}` })).toContainText("R$ 1.400,00");
  await expect(
    page.getByRole("region", { name: `Função ${nome}` }).getByLabel("Conta do plano"),
  ).toHaveValue("04.03.99");
  await page
    .getByRole("region", { name: `Função ${nome}` })
    .getByRole("button", { name: "Inativar função" })
    .click();
});

test("nome repetido é recusado e o campo volta ao nome salvo", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/funcoes");
  await page.getByRole("button", { name: "Eletricista", exact: true }).click();
  const painel = page.getByRole("region", { name: "Função Eletricista" });
  await painel.getByLabel("Nome").fill("Servente");
  await painel.getByLabel("Nome").blur();
  await expect(page.getByRole("status")).toContainText("Já existe");
  await expect(painel.getByLabel("Nome")).toHaveValue("Eletricista");
});

test("sinônimo de outra função é recusado dizendo onde ele está", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/funcoes");
  await page.getByRole("button", { name: "Nova função" }).click();
  const painel = page.getByRole("region", { name: "Nova função" });
  await painel.getByLabel("Nome").fill(`Ajudante teste ${Date.now()}`);
  await painel.getByLabel("Como aparece na folha (opcional)").fill("ajudante geral");
  await painel.getByRole("button", { name: "Criar função" }).click();
  await expect(
    painel.getByText('O sinônimo "AJUDANTE GERAL" já está na função Servente. Use outro texto.'),
  ).toBeVisible();
});
