import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiAdmin, entrar } from "./ajuda";

// M10: nenhuma violação séria ou crítica (WCAG 2.1 A/AA) nas telas, nos modos claro e escuro,
// e os fluxos principais funcionam só com o teclado.
const OBRA = "a11y_e2e";
const NOME_PROJ = "E2E Acessibilidade";
let projecao = "";

test.beforeAll(async () => {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: OBRA }).catch(() => {});
  await api.apagar(`projecoes?nome=eq.${encodeURIComponent(NOME_PROJ)}`);
  await api.inserir("rpc/gravar_carga", {
    p: {
      obra: {
        id: OBRA,
        nome: "Acessibilidade E2E",
        area_m2: 3000,
        inicio: "2025-01-01",
        meses: 2,
        data_base: 2025,
      },
      competencias: [0, 1].map((mes_idx) => ({ mes_idx, he_media: 8 })),
      lancamentos: [0, 1].map((mes_idx) => ({
        mes_idx,
        matricula: "801",
        funcao_id: "ped",
        equivalente: 1,
        rubricas: [{ codigo: 1, referencia: 220, valor: 1650 }],
      })),
    },
  });
  await api.inserir("projecoes", {
    nome: NOME_PROJ,
    inicio: "2027-03-01",
    prazo_meses: 3,
    area_m2: 1000,
    cidade_id: "vespasiano",
    quantidades_manuais: { ped: [2, 2, 2] },
  });
  const [p] = await api.ler<{ id: string }[]>(
    `projecoes?select=id&nome=eq.${encodeURIComponent(NOME_PROJ)}`,
  );
  projecao = p!.id;
});

test.afterAll(async () => {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: OBRA }).catch(() => {});
  await api.apagar(`projecoes?nome=eq.${encodeURIComponent(NOME_PROJ)}`);
});

async function varrer(page: Page, onde: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  // a varredura rodou de verdade (regras aplicadas à página)
  expect(r.passes.length, `axe sem regras aplicadas em ${onde}`).toBeGreaterThan(10);
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${onde}: ${v.id} (${v.impact}) em ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
}

const ROTAS = () => [
  "/base",
  "/comparar",
  "/projecoes",
  "/carga",
  "/cidades",
  "/parametros",
  "/funcoes",
  "/rubricas",
  `/obras/${OBRA}`,
  `/projecoes/${projecao}`,
  "/auditoria",
  "/usuarios",
];

for (const tema of ["claro", "escuro"] as const) {
  test(`telas sem violação séria de acessibilidade — modo ${tema}`, async ({ page }) => {
    // varre 13 telas e 2 estados abertos num teste só: os 30 s padrão ficam no limite no CI
    test.setTimeout(120_000);
    await page.addInitScript((t) => localStorage.setItem("ito.tema", t), tema);
    const achados: string[] = [];
    await page.goto("/entrar");
    await expect(page.getByRole("heading", { name: "Entrar no ITO" })).toBeVisible();
    achados.push(...(await varrer(page, "/entrar")));
    await entrar(page, "admin@ito.local");
    for (const rota of ROTAS()) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      achados.push(...(await varrer(page, rota)));
    }
    // estados abertos: formulário de convite e histórico de alterações
    await page.goto("/usuarios");
    await page.getByRole("button", { name: "Convidar usuário" }).click();
    achados.push(...(await varrer(page, "/usuarios (convite aberto)")));
    await page.goto(`/obras/${OBRA}`);
    await page
      .getByRole("region", { name: "Histórico de alterações" })
      .getByRole("button", { name: "Mostrar" })
      .click();
    await page.waitForLoadState("networkidle");
    achados.push(...(await varrer(page, "obra (histórico aberto)")));
    expect(achados).toEqual([]);
  });
}

test("teclado: busca global com Ctrl+K, menu e abas da obra", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  // busca global abre pelo atalho e leva à tela pelo Enter
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.type("rubricas da folha");
  await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Rubricas da folha" })).toBeVisible();

  // o menu é alcançável por Tab e o foco fica visível
  await page.goto("/base");
  await expect(page.getByRole("heading", { level: 1, name: "Base histórica" })).toBeVisible();
  await page.keyboard.press("Tab");
  const focado = page.locator(":focus");
  await expect(focado).toBeVisible();
  const contorno = await focado.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== "none" || s.boxShadow !== "none";
  });
  expect(contorno, "foco visível").toBe(true);

  // abas da obra com as setas
  await page.goto(`/obras/${OBRA}`);
  const abas = page.getByRole("tablist", { name: "Abas da obra" });
  const primeira = abas.getByRole("tab").first();
  await primeira.focus();
  await page.keyboard.press("ArrowRight");
  await expect(abas.getByRole("tab").nth(1)).toBeFocused();
  await expect(abas.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
});
