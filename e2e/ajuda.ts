import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const SENHA = "ito-dev-2026";

/** Entra com um usuário do seed e espera o shell carregar. */
export async function entrar(page: Page, email = "planejamento@ito.local") {
  // começa de uma página nova: depois de "Sair", /entrar guarda a tela de onde a pessoa saiu e,
  // recarregado no mesmo endereço, levaria de volta para ela em vez da base
  await page.goto("about:blank");
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/base$/);
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
}

/**
 * Regra 8: nem a página nem nenhuma tabela passa da largura do seu contêiner.
 * (Os cartões têm overflow: hidden; olhar só o documento esconderia a tabela cortada.)
 */
export async function semRolagemLateral(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) return false;
    // tabelas mês a mês rolam dentro do próprio cartão (overflow-x: auto), como manda a regra 8
    return [...document.querySelectorAll("table")].every(
      (t) =>
        !t.parentElement ||
        getComputedStyle(t.parentElement).overflowX === "auto" ||
        t.scrollWidth <= t.parentElement.clientWidth + 1,
    );
  });
}

function envLocal(): Record<string, string> {
  try {
    const txt = readFileSync("apps/web/.env.local", "utf8");
    return Object.fromEntries(
      txt
        .split(/\r?\n/)
        .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1]!, m[2]!]),
    );
  } catch {
    return {};
  }
}

/** Chamadas REST como admin do seed, para os testes limparem o que criam. */
export async function apiAdmin() {
  const env = envLocal();
  const url = env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54821";
  const chave = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@ito.local", password: SENHA }),
  });
  const { access_token } = (await r.json()) as { access_token: string };
  const cab = {
    apikey: chave,
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };
  return {
    ler: async <T = unknown>(caminho: string): Promise<T> => {
      const r = await fetch(`${url}/rest/v1/${caminho}`, { headers: cab });
      if (!r.ok) throw new Error(`GET ${caminho}: ${r.status} ${await r.text()}`);
      return (await r.json()) as T;
    },
    apagar: (caminho: string) =>
      fetch(`${url}/rest/v1/${caminho}`, { method: "DELETE", headers: cab }),
    inserir: async (caminho: string, corpo: unknown) => {
      const r = await fetch(`${url}/rest/v1/${caminho}`, {
        method: "POST",
        headers: cab,
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error(`POST ${caminho}: ${r.status} ${await r.text()}`);
      return r;
    },
    alterar: (caminho: string, corpo: unknown) =>
      fetch(`${url}/rest/v1/${caminho}`, {
        method: "PATCH",
        headers: cab,
        body: JSON.stringify(corpo),
      }),
  };
}
