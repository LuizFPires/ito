import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

const NOME = "E2E Auditoria";

test.afterAll(async () => {
  const api = await apiAdmin();
  await api.apagar(`projecoes?nome=eq.${encodeURIComponent(NOME)}`);
});

test("alteração vira linha da auditoria com antes e depois; histórico no detalhe", async ({
  page,
}) => {
  const api = await apiAdmin();
  await api.apagar(`projecoes?nome=eq.${encodeURIComponent(NOME)}`);
  await api.inserir("projecoes", {
    nome: NOME,
    inicio: "2027-01-01",
    prazo_meses: 3,
    area_m2: 5000,
    cidade_id: "vespasiano",
    quantidades_manuais: { ped: [2, 2, 2] },
  });
  const [p] = await api.ler<{ id: string }[]>(
    `projecoes?select=id&nome=eq.${encodeURIComponent(NOME)}`,
  );
  await api.alterar(`projecoes?id=eq.${p!.id}`, { area_m2: 6500 });

  await entrar(page, "diretoria@ito.local");
  await page.getByRole("link", { name: "Auditoria" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Auditoria" })).toBeVisible();
  await page.getByLabel("Módulo").selectOption("projecoes");
  const linha = page.getByRole("row").filter({ hasText: "area m2" }).first();
  await expect(linha).toContainText("5.000");
  await expect(linha).toContainText("6.500");
  await expect(linha).toContainText("admin@ito.local");
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await semRolagemLateral(page)).toBe(true);

  await page.goto(`/projecoes/${p!.id}`);
  const hist = page.getByRole("region", { name: "Histórico de alterações" });
  await hist.getByRole("button", { name: "Mostrar" }).click();
  await expect(hist.getByRole("row").filter({ hasText: "area m2" })).toContainText("6.500");
});

test("quem não lê a auditoria não vê o menu nem os dados", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
  await page.goto("/auditoria");
  await expect(page.getByText("A auditoria é restrita")).toBeVisible();
});
