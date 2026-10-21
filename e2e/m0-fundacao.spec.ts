import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const SENHA = "ito-dev-2026";

async function entrar(page: Page, email = "planejamento@ito.local") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/base$/);
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
}

const ROTAS: [string, string, string][] = [
  ["/base", "Base histórica", "Base histórica"],
  ["/comparar", "Comparar obras", "Comparar obras"],
  ["/projecoes", "Projeções", "Projeções"],
  ["/carga", "Carga de dados", "Carga de dados"],
  ["/cidades", "Cidades e CCTs", "Cidades e CCTs"],
  ["/parametros", "Parâmetros", "Parâmetros"],
  ["/funcoes", "Funções padrão", "Funções padrão"],
  ["/rubricas", "Rubricas da folha", "Rubricas da folha"],
  ["/obras/exemplo", "Obra", "Base histórica"],
  ["/projecoes/exemplo", "Projeção", "Projeções"],
];

test("sem login, qualquer rota leva ao login", async ({ page }) => {
  await page.goto("/cidades");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar no ITO" })).toBeVisible();
});

test("senha errada mostra o que fazer", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("planejamento@ito.local");
  await page.getByLabel("Senha").fill("errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha incorretos. Confira e tente de novo.",
  );
});

test("campos vazios pedem e-mail e senha", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Informe o e-mail e a senha.");
});

test("login volta para a rota pedida", async ({ page }) => {
  await page.goto("/rubricas");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("E-mail").fill("engenharia@ito.local");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/rubricas$/);
});

test("as 10 rotas abrem vazias, com o item do menu marcado e sem rolagem lateral", async ({
  page,
}) => {
  await entrar(page);
  const menu = page.getByRole("navigation", { name: "Menu" });
  for (const [rota, titulo, item] of ROTAS) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1, name: titulo, exact: true })).toBeVisible();
    // Telas que já ganharam conteúdo (M1, M2, M4, M5) não mostram o aviso de "chega no Mx".
    if (!["/funcoes", "/rubricas", "/parametros", "/cidades", "/carga", "/base"].includes(rota)) {
      await expect(page.getByText(/Esta tela chega no M\d+\./)).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: item, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const lateral = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(lateral, `rolagem lateral em ${rota}`).toBe(false);
  }
});

test("menu leva às telas", async ({ page }) => {
  await entrar(page);
  await page.getByRole("link", { name: "Cidades e CCTs" }).click();
  await expect(page).toHaveURL(/\/cidades$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cidades e CCTs");
});

test("busca global com Ctrl+K", async ({ page }) => {
  await entrar(page);
  await page.keyboard.press("Control+k");
  const busca = page.getByRole("combobox", { name: "Buscar no ITO" });
  await expect(busca).toBeFocused();
  await busca.fill("rubricas");
  await expect(page.getByRole("option", { name: /Rubricas da folha/ })).toBeVisible();
  await busca.press("Enter");
  await expect(page).toHaveURL(/\/rubricas$/);
  await busca.fill("xyzabc");
  await expect(page.getByText("Nada encontrado para “xyzabc”.")).toBeVisible();
});

test("tema escuro e claro aplicam tokens e ficam lembrados", async ({ page }) => {
  await entrar(page);
  const fundo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await page.getByRole("button", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await fundo()).toBe("rgb(17, 19, 21)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await page.getByRole("button", { name: "Claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await fundo()).toBe("rgb(255, 255, 255)");
});

test("menu do usuário mostra o perfil e sair encerra a sessão", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await expect(page.getByText("DP / RH")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/base");
  await expect(page).toHaveURL(/\/entrar$/);
});
