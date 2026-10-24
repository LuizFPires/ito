import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import writeXlsxFile from "write-excel-file/node";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

// Aceite do M11: obra criada em andamento recebe três meses, um por vez (com um mês refeito),
// aparece na base com o selo, não entra como referência de projeção, é concluída e passa a entrar.
const ID = "obra_e2e_andamento";
const NOME = "Obra E2E Andamento";

const linha = (xs: (string | number)[]) => xs.map((value) => ({ value }));

/** Folha sintética de uma competência: `pessoas` pedreiros (matrículas 9101, 9102…). */
async function folhaDoMes(comp: string, pessoas: number): Promise<Buffer> {
  const arq = `test-results/folha_e2e_m11_${comp.replace("/", "_")}_${pessoas}.xlsx`;
  const mats = Array.from({ length: pessoas }, (_, i) => 9101 + i);
  await writeXlsxFile([
    {
      sheet: "Rubricas",
      data: [
        ["Competência", "Matrícula", "Função", "Rubrica", "Descrição", "Referência", "Valor"],
        ...mats.map((m) => [comp, m, "PEDREIRO", 1, "HORAS NORMAIS", 220, 1650]),
      ].map(linha),
    },
    {
      sheet: "Pessoas",
      data: [
        ["Competência", "Matrícula", "Função", "Dias de vínculo", "Admitido", "Desligado"],
        ...mats.map((m) => [comp, m, "PEDREIRO", "", "", ""]),
      ].map(linha),
    },
    {
      sheet: "Resumo",
      data: [
        ["Competência", "Total de proventos"],
        [comp, 1650 * pessoas],
      ].map(linha),
    },
  ]).toFile(arq);
  return readFileSync(arq);
}

async function limpar() {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: ID }).catch(() => {});
  await api.apagar("carga_rascunhos?titulo=like.*E2E Andamento*");
}
test.beforeAll(limpar);
test.afterAll(limpar);

const continuar = (page: Page) => page.getByRole("button", { name: "Continuar →" }).click();

/** Na tela de lançar mês: envia a folha, passa pelas etapas e grava. */
async function lancar(page: Page, comp: string, pessoas: number, botao: RegExp) {
  await page.getByLabel("Folha de pagamento com rubricas").setInputFiles({
    name: `folha_${comp}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await folhaDoMes(comp, pessoas),
  });
  await expect(page.getByText(/1 competência · /)).toBeVisible();
  await continuar(page);
  await expect(page.getByRole("row", { name: /^PEDREIRO / })).toContainText("reconhecida");
  await continuar(page);
  await continuar(page);
  const verif = page.getByRole("region", { name: "Verificação antes de salvar" });
  await expect(verif.locator('[data-verificacao="resumo"]')).toContainText("confere com o resumo");
  expect(await semRolagemLateral(page)).toBe(true);
  await page.getByRole("button", { name: botao }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${ID}$`));
}

test("obra em andamento: começa sem folha, recebe três meses, refaz um e é concluída", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await entrar(page, "dprh@ito.local");

  // começa pela carga, só com o cadastro
  await page.goto("/carga");
  await page.getByLabel("Nome da obra").fill(NOME);
  await page.getByLabel("Área construída (m²)").fill("3.000");
  await page.getByLabel("Área construída (m²)").blur();
  await page.getByLabel("Tipologia").selectOption("Comercial");
  await page
    .getByRole("group", { name: "Situação da obra" })
    .getByRole("button", { name: "Em andamento" })
    .click();
  await page.getByLabel("Início da obra").fill("2026-01");
  await page.getByLabel("Prazo previsto (meses)").fill("12");
  await page.getByLabel("Prazo previsto (meses)").blur();
  await expect(page.getByLabel("Término da obra")).toHaveCount(0);
  await continuar(page);
  await page.getByRole("button", { name: "Começar a obra sem folha →" }).click();

  await expect(page).toHaveURL(new RegExp(`/obras/${ID}$`));
  const barra = page.getByRole("region", { name: "Obra em andamento" });
  await expect(barra).toContainText("nenhum mês lançado");
  await expect(page.getByText("Nenhum mês lançado ainda.")).toBeVisible();

  // três meses, um por vez
  await barra.getByRole("link", { name: "Lançar jan/26 →" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lançar jan/26" })).toBeVisible();
  await lancar(page, "01/2026", 1, /^Lançar jan\/26 →/);
  await expect(barra).toContainText("1 de 12 meses previstos");

  await barra.getByRole("link", { name: "Lançar fev/26 →" }).click();
  await lancar(page, "02/2026", 1, /^Lançar fev\/26 →/);
  await barra.getByRole("link", { name: "Lançar mar/26 →" }).click();
  // a folha de outra competência é recusada antes de gravar
  await page.getByLabel("Folha de pagamento com rubricas").setInputFiles({
    name: "folha_errada.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await folhaDoMes("02/2026", 1),
  });
  await continuar(page);
  await continuar(page);
  await continuar(page);
  await expect(
    page
      .getByRole("region", { name: "Verificação antes de salvar" })
      .locator('[data-verificacao="periodo"]'),
  ).toContainText("envie a folha só de mar/26");
  await page.getByRole("button", { name: /^01 Arquivos/ }).click();
  await lancar(page, "03/2026", 1, /^Lançar mar\/26 →/);
  await expect(barra).toContainText("3 de 12 meses previstos");

  // refaz fev com dois pedreiros: só fev muda
  await page.goto(`/obras/${ID}/lancar?mes=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Refazer fev/26" })).toBeVisible();
  await lancar(page, "02/2026", 2, /^Refazer fev\/26 →/);
  const api = await apiAdmin();
  const efetivo = await api.ler<{ mes_idx: number; equivalente: number }[]>(
    `efetivo_mes?obra_id=eq.${ID}&select=mes_idx,equivalente&order=mes_idx`,
  );
  expect(efetivo.map((e) => Number(e.equivalente))).toEqual([1, 2, 1]);

  // na base com o selo; ainda não é referência de projeção
  await page.goto("/base");
  await page.getByRole("searchbox", { name: "Filtrar obras" }).fill(NOME);
  const linhaBase = page.getByRole("row", { name: new RegExp(NOME) });
  await expect(linhaBase).toContainText("em andamento");
  await expect(linhaBase).toContainText("3 de 12 meses previstos");
  await page
    .getByRole("group", { name: "Situação da obra" })
    .getByRole("button", { name: "Concluídas" })
    .click();
  await expect(page.getByRole("row", { name: new RegExp(NOME) })).toHaveCount(0);

  await page.goto(`/obras/${ID}`);
  await expect(page.getByRole("link", { name: "Usar como referência →" })).toHaveCount(0);

  // concluir: o período fecha no último mês lançado e a obra vira referência
  page.once("dialog", (d) => void d.accept());
  await barra.getByRole("button", { name: "Concluir obra" }).click();
  await expect(barra).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usar como referência →" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reabrir obra" })).toBeVisible();
  await expect(page.getByText("jan/26 – mar/26").first()).toBeVisible();
});

test("quem não carrega vê a situação, mas não lança nem conclui", async ({ page }) => {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: ID }).catch(() => {});
  await api.inserir("rpc/gravar_carga", {
    p: {
      obra: {
        id: ID,
        nome: NOME,
        area_m2: 3000,
        inicio: "2026-01-01",
        meses: 0,
        data_base: 2025,
        situacao: "andamento",
      },
    },
  });
  await entrar(page, "engenharia@ito.local");
  await page.goto(`/obras/${ID}`);
  const barra = page.getByRole("region", { name: "Obra em andamento" });
  await expect(barra).toContainText("nenhum mês lançado");
  await expect(barra.getByRole("link", { name: /^Lançar/ })).toHaveCount(0);
  await page.goto(`/obras/${ID}/lancar`);
  await expect(
    page.getByText("Só DP/RH, controladoria ou um administrador lança meses da obra."),
  ).toBeVisible();
});
