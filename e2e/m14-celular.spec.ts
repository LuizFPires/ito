import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

// M14: no celular (390 px) a página não rola de lado; tabela larga rola dentro do cartão
test.use({ viewport: { width: 390, height: 844 } });

const ROTAS = [
  "/base",
  "/comparar",
  "/projecoes",
  "/projecoes/nova",
  "/carga",
  "/cidades",
  "/parametros",
  "/funcoes",
  "/rubricas",
  "/auditoria",
  "/usuarios",
  "/desempenho",
];

test("telas principais em 390 px sem rolagem lateral da página", async ({ page }) => {
  test.setTimeout(90_000); // 12 telas num teste só
  await entrar(page, "admin@ito.local");
  for (const rota of ROTAS) {
    await page.goto(rota);
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      // cada tabela que passa da tela está dentro de algo que rola (o cartão)
      const soltas = [...document.querySelectorAll("table")].filter((t) => {
        if (t.getBoundingClientRect().right <= innerWidth + 1) return false;
        for (let el = t.parentElement; el; el = el.parentElement)
          if (getComputedStyle(el).overflowX === "auto") return false;
        return true;
      });
      return { pagina: doc.scrollWidth <= doc.clientWidth, soltas: soltas.length };
    });
    expect(r, rota).toEqual({ pagina: true, soltas: 0 });
  }
});
