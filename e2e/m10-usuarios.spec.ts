import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { entrar, semRolagemLateral } from "./ajuda";

const URL_API = "http://127.0.0.1:54821";
const MAILPIT = "http://127.0.0.1:54824";
const EMAIL = `e2e-convite-${Date.now()}@ito.local`;

/** Chave de serviço do Supabase local, só para o teste apagar o usuário que criou. */
function chaveServico(): string {
  const env = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  return /SERVICE_ROLE_KEY="?([^"\r\n]+)"?/.exec(env)?.[1] ?? "";
}

test.afterAll(async () => {
  const chave = chaveServico();
  const cab = { apikey: chave, Authorization: `Bearer ${chave}` };
  const r = await fetch(`${URL_API}/auth/v1/admin/users?per_page=200`, { headers: cab });
  const { users } = (await r.json()) as { users: { id: string; email: string }[] };
  for (const u of users.filter((x) => x.email.startsWith("e2e-convite-")))
    await fetch(`${URL_API}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: cab });
});

test("admin convida, muda o perfil, desativa e reativa; a pessoa define a senha pelo e-mail", async ({
  page,
  browser,
}) => {
  await entrar(page, "admin@ito.local");
  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();

  // a própria linha: sem desativar e sem tirar o próprio admin
  const eu = page.getByRole("row").filter({ hasText: "admin@ito.local" });
  await expect(eu.getByRole("button", { name: "Desativar" })).toHaveCount(0);
  await expect(eu.getByRole("switch")).toBeDisabled();

  await page.getByRole("button", { name: "Convidar usuário" }).click();
  const form = page.getByRole("region", { name: "Convidar usuário" });
  await form.getByLabel("E-mail").fill(EMAIL);
  await form.getByLabel("Nome").fill("Pessoa Convidada");
  await form.getByLabel("Perfil").selectOption("dp_rh");
  await form.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText("Convite enviado")).toBeVisible();

  const linha = page.getByRole("row").filter({ hasText: EMAIL });
  await expect(linha).toContainText("convite pendente");
  await linha.getByLabel(`Perfil de ${EMAIL}`).selectOption("diretoria");
  await expect(page.getByText("Salvo")).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await linha.getByRole("button", { name: "Desativar" }).click();
  await expect(linha).toContainText("desativado");
  await linha.getByRole("button", { name: "Reativar" }).click();
  await expect(linha).toContainText("convite pendente");
  await linha.getByRole("button", { name: "Enviar link de senha" }).click();
  await expect(page.getByText("Link enviado por e-mail")).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  // ordenar por perfil: Controladoria (admin) antes de Diretoria
  await page.getByRole("button", { name: "Perfil" }).click();
  const perfis = await page
    .getByRole("table", { name: "Usuários" })
    .getByRole("combobox")
    .evaluateAll((s) => s.map((x) => (x as HTMLSelectElement).value));
  expect(perfis.indexOf("controladoria")).toBeLessThan(perfis.indexOf("diretoria"));

  // o e-mail do convite (Mailpit do Supabase local) leva a definir a senha
  let link = "";
  await expect(async () => {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`);
    const { messages } = (await r.json()) as { messages: { ID: string; Subject: string }[] };
    expect(messages[0]?.Subject).toBe("Convite para o ITO");
    const m = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as {
      HTML: string;
    };
    link = /href="([^"]+)"/.exec(m.HTML)![1]!.replace(/&amp;/g, "&");
  }).toPass({ timeout: 15_000 });

  const outra = await browser.newContext();
  const convidada = await outra.newPage();
  await convidada.goto(link);
  await expect(convidada.getByRole("heading", { name: "Definir senha" })).toBeVisible();
  await convidada.getByLabel("Nova senha").fill("senha-e2e-2026");
  await convidada.getByLabel("Confirme a senha").fill("senha-e2e-2026");
  await convidada.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(convidada.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
  // perfil trocado para diretoria: lê a auditoria, não gere usuários
  await expect(convidada.getByRole("link", { name: "Auditoria" })).toBeVisible();
  await expect(convidada.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await outra.close();
});

test("tabela de permissões vem do banco", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  await page.goto("/usuarios");
  const tabela = page.getByRole("table", { name: "Permissões por perfil" });
  const parametros = tabela.getByRole("row").filter({ hasText: "Parâmetros" });
  // colunas: módulo, planejamento, engenharia, DP/RH, controladoria, diretoria, admin
  await expect(parametros.getByRole("cell")).toHaveText([
    /Parâmetros/,
    "Lê",
    "Lê",
    "Lê",
    "Edita",
    "Lê",
    "Edita",
  ]);
  const folha = tabela.getByRole("row").filter({ hasText: "Folha por matrícula" });
  await expect(folha.getByRole("cell").nth(2)).toHaveText("Só totais");
});

test("quem não é admin não vê a tela de usuários no menu", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
});
