import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiAdmin, codigoTotp, SENHA } from "./ajuda";

// M13 · S02: administrador, controladoria e diretoria só entram com o código do aplicativo
// autenticador. mfa@ito.local (diretoria) é a única conta do seed local que precisa do MFA.
const EMAIL = "mfa@ito.local";
const ID = "00000000-0000-4000-8000-000000000006";

async function zerar() {
  const api = await apiAdmin();
  await api.funcao("usuarios", { acao: "zerar_mfa", id: ID });
}
test.beforeAll(zerar);
test.afterAll(zerar);

async function senha(page: Page) {
  await page.goto("about:blank");
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("primeiro acesso ativa o segundo fator; depois, só o código", async ({ page }) => {
  await senha(page);
  await expect(page.getByRole("heading", { name: "Ative o segundo fator" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "QR code para o aplicativo autenticador" }),
  ).toBeVisible();
  const segredo = (await page.locator("[data-segredo]").textContent())!.trim();

  // código errado é recusado com o que fazer
  await page.getByLabel("Código do aplicativo").fill("000000");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("Código incorreto");

  await page.getByLabel("Código do aplicativo").fill(codigoTotp(segredo));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();

  // novo login: pede só o código
  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await senha(page);
  await expect(page.getByRole("heading", { name: "Código de acesso" })).toBeVisible();
  await expect(page.locator("[data-segredo]")).toHaveCount(0);
  // o código anterior pode ter sido usado: espera a janela seguinte se for o mesmo
  await page.getByLabel("Código do aplicativo").fill(codigoTotp(segredo, Date.now() + 30_000));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
});

test("só com a senha (AAL1), a API não entrega nada a quem precisa do MFA", async () => {
  const { readFileSync } = await import("node:fs");
  const env = Object.fromEntries(
    readFileSync("apps/web/.env.local", "utf8")
      .split(/\r?\n/)
      .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1]!, m[2]!]),
  );
  const url = env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54821";
  const chave = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const { access_token } = (await r.json()) as { access_token: string };
  const funcoes = await fetch(`${url}/rest/v1/funcoes?select=id`, {
    headers: { apikey: chave, Authorization: `Bearer ${access_token}` },
  });
  expect(await funcoes.json()).toEqual([]);
});
