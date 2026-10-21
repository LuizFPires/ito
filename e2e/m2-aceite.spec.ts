import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

/**
 * Aceite do M2 (PLAN): com 100 CCTs e 500 cidades, achar e editar qualquer uma em menos de 3
 * interações (buscar + editar; ou buscar + abrir, para a CCT), sem rolagem lateral em 1.280 px.
 */
const N_CCT = 100;
const N_CID = 500;
const doisDig = (i: number, n = 3) => String(i).padStart(n, "0");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const api = await apiAdmin();
  await api.apagar("cidades?id=like.massa_cid_*");
  await api.apagar("ccts?id=like.massa_cct_*");
  await api.inserir(
    "ccts",
    Array.from({ length: N_CCT }, (_, i) => ({
      id: `massa_cct_${doisDig(i)}`,
      nome: `Massa CCT ${doisDig(i)}`,
      mes_data_base: (i % 12) + 1,
      reajuste_estimado_pct: 5,
    })),
  );
  await api.inserir(
    "cct_salarios",
    Array.from({ length: N_CCT }, (_, i) => ({
      cct_id: `massa_cct_${doisDig(i)}`,
      funcao_id: "ped",
      valor: 1300 + i,
    })),
  );
  await api.inserir(
    "cidades",
    Array.from({ length: N_CID }, (_, i) => ({
      id: `massa_cid_${doisDig(i)}`,
      nome: `Massa ${doisDig(i)}`,
      uf: "MG",
      cct_id: `massa_cct_${doisDig(i % N_CCT)}`,
      tarifa_local: 5,
      conducoes: 1,
      iss_pct: 3,
    })),
  );
});

test.afterAll(async () => {
  const api = await apiAdmin();
  await api.apagar("cidades?id=like.massa_cid_*");
  await api.apagar("ccts?id=like.massa_cct_*");
});

test("cidade entre 500: buscar e editar na própria linha (2 interações)", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  await page.goto("/cidades");
  await page.getByRole("button", { name: /^Cidades/ }).click();
  await expect(page.getByText(/de 5\d\d cidades/)).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);

  // 1) buscar
  await page.getByRole("searchbox", { name: "Buscar cidade" }).fill("massa 437");
  const tarifa = page.getByLabel("Tarifa local de Massa 437/MG");
  // 2) editar
  await tarifa.fill("6,1");
  await tarifa.press("Enter");
  await expect(page.getByRole("status")).toContainText("Salvo");
  await expect(page.getByRole("table", { name: "Cidades" }).getByRole("row").nth(1)).toContainText(
    "VT local R$ 12,20/dia",
  );
  expect(await semRolagemLateral(page)).toBe(true);
});

test("convenção entre 100: buscar, abrir e editar (3 ações, 2 para achar)", async ({ page }) => {
  await entrar(page, "admin@ito.local");
  await page.goto("/cidades");
  await expect(page.getByText(/de 1\d\d convenções/)).toBeVisible();

  // 1) buscar (também pela cidade coberta)
  await page.getByRole("searchbox", { name: "Buscar convenção ou cidade" }).fill("massa 177");
  const lista = page.getByRole("list", { name: "Convenções" });
  await expect(lista.getByRole("listitem")).toHaveCount(1);
  // 2) abrir
  await lista.getByRole("button", { name: /Massa CCT 077/ }).click();
  const salario = page.getByLabel("Salário de Pedreiro");
  await expect(salario).toHaveValue("1.377,00");
  // editar
  await salario.fill("1.400");
  await salario.press("Enter");
  await expect(page.getByRole("status")).toContainText("Salvo");
  expect(await semRolagemLateral(page)).toBe(true);
});
