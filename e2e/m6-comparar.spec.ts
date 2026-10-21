import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

// Duas obras sintéticas (só matrícula) de durações diferentes.
const obra = (id: string, nome: string, meses: number, pedreiros: number) => ({
  obra: {
    id,
    nome,
    cliente: "Cliente E2E",
    tipologia: "Galpão logístico",
    area_m2: 2000,
    inicio: "2025-01-01",
    meses,
    data_base: 2025,
  },
  competencias: Array.from({ length: meses }, (_, mes_idx) => ({ mes_idx, he_media: 10 })),
  lancamentos: Array.from({ length: meses }, (_, mes_idx) =>
    Array.from({ length: pedreiros }, (_, j) => ({
      mes_idx,
      matricula: `${700 + j}`,
      funcao_id: "ped",
      equivalente: 1,
      rubricas: [{ codigo: 1, referencia: 220, valor: 1650 }],
    })),
  ).flat(),
});

async function limpar() {
  const api = await apiAdmin();
  for (const id of ["cmp_e2e_a", "cmp_e2e_b"])
    await api.inserir("rpc/excluir_obra", { p_id: id }).catch(() => {});
}
test.beforeAll(async () => {
  await limpar();
  const api = await apiAdmin();
  await api.inserir("rpc/gravar_carga", { p: obra("cmp_e2e_a", "Comparar E2E A", 3, 2) });
  await api.inserir("rpc/gravar_carga", { p: obra("cmp_e2e_b", "Comparar E2E B", 5, 4) });
});
test.afterAll(limpar);

test("abre a partir da seleção na base: curvas e indicadores lado a lado", async ({ page }) => {
  await entrar(page, "planejamento@ito.local");
  await page.getByRole("searchbox", { name: "Filtrar obras" }).fill("Comparar E2E");
  await page.getByLabel("Selecionar Comparar E2E A").check();
  await page.getByLabel("Selecionar Comparar E2E B").check();
  await page
    .getByRole("region", { name: "Obras selecionadas" })
    .getByRole("button", { name: "Comparar" })
    .click();
  await expect(page).toHaveURL(/\/comparar$/);
  const tabela = page.getByRole("table", { name: "Indicadores" });
  await expect(tabela).toContainText("Comparar E2E A");
  await expect(tabela).toContainText("Comparar E2E B");
  // pessoa-mês por 1.000 m²: A = 6 ÷ 2.000 × 1.000 = 3,0; B = 20 ÷ 2.000 × 1.000 = 10,0
  await expect(tabela.getByRole("row", { name: /Pessoa-mês \/ 1\.000 m²/ })).toContainText("3,0");
  await expect(tabela.getByRole("row", { name: /Pessoa-mês \/ 1\.000 m²/ })).toContainText("10,0");
  await expect(
    page.getByRole("img", { name: "Histograma de pessoas por 1.000 m² por mês relativo" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Mix de funções" })).toContainText("Pedreiro 100%");
  await page.getByRole("button", { name: "Curva S de custo" }).click();
  await page.getByRole("button", { name: "% do prazo" }).click();
  await expect(page.getByRole("img", { name: "Curva S de custo" })).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  // tirar uma obra volta ao pedido de escolher
  await page.getByRole("button", { name: "Tirar Comparar E2E B da comparação" }).click();
  await expect(page.getByText("Escolha pelo menos duas obras")).toBeVisible();
});

test("abre pelo botão “Comparar com…” na obra, juntando à seleção", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/obras/cmp_e2e_a");
  await page.getByRole("link", { name: "Comparar com…" }).click();
  await expect(page).toHaveURL(/\/comparar$/);
  await expect(page.getByRole("region", { name: "Obras comparadas" })).toContainText(
    "Comparar E2E A",
  );
  const incluir = page.getByLabel("Incluir obra na comparação");
  await incluir.fill("Comparar E2E B · Cliente E2E · jan/25");
  await incluir.press("Enter");
  await expect(page.getByRole("table", { name: "Indicadores" })).toContainText("Comparar E2E B");
});

test("“Comparar com…” com a seleção cheia põe a obra na frente", async ({ page }) => {
  await entrar(page, "planejamento@ito.local");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "ito.selecao.obras",
      JSON.stringify(["x1", "x2", "x3", "x4", "cmp_e2e_a"]),
    ),
  );
  await page.goto("/obras/cmp_e2e_b");
  await page.getByRole("link", { name: "Comparar com…" }).click();
  // ids de obras que não existem saem; B vem na frente, seguida de A
  await expect(page.getByRole("region", { name: "Obras comparadas" })).toContainText("(2 de 4)");
  await expect(page.getByRole("region", { name: "Obras comparadas" })).toContainText(
    "Comparar E2E B",
  );
});
