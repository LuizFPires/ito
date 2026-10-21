import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import writeXlsxFile from "write-excel-file/node";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

// Folha sintética no layout do ITO (só matrícula; a coluna Nome tem de ser ignorada).
// mar/25: pedreiro 9001 (admitido, 10 h HE) e auxiliar 9002; abr/25: 9002 trabalhou na Obra B.
const RUB = [
  "Competência",
  "Matrícula",
  "Nome",
  "Função",
  "Rubrica",
  "Descrição",
  "Referência",
  "Valor",
];
const PES = [
  "Competência",
  "Matrícula",
  "Função",
  "Dias de vínculo",
  "Admitido",
  "Desligado",
  "Faltas (h)",
  "Obra onde trabalhou",
];
const linha = (xs: (string | number)[]) => xs.map((value) => ({ value }));

async function folhaXlsx(): Promise<Buffer> {
  const arq = "test-results/folha_e2e_m4.xlsx";
  await writeXlsxFile([
    {
      sheet: "Rubricas",
      data: [
        RUB,
        ["03/2025", 9001, "TRABALHADOR FICTICIO", "PEDREIRO", 1, "HORAS NORMAIS", 220, 1650],
        ["03/2025", 9001, "TRABALHADOR FICTICIO", "PEDREIRO", 200, "HE 100%", 10, 150],
        ["03/2025", 9002, "OUTRO FICTICIO", "AUXILIAR E2E", 1, "HORAS NORMAIS", 220, 1100],
        ["03/2025", 9002, "OUTRO FICTICIO", "AUXILIAR E2E", 7777, "PRÊMIO E2E", 0, 80],
        ["04/2025", 9001, "TRABALHADOR FICTICIO", "PEDREIRO", 1, "HORAS NORMAIS", 220, 1650],
        ["04/2025", 9002, "OUTRO FICTICIO", "AUXILIAR E2E", 1, "HORAS NORMAIS", 220, 1100],
      ].map(linha),
    },
    {
      sheet: "Pessoas",
      data: [
        PES,
        ["03/2025", 9001, "PEDREIRO", "", "S", "", 0, ""],
        ["03/2025", 9002, "AUXILIAR E2E", "", "", "", 0, ""],
        ["04/2025", 9001, "PEDREIRO", "", "", "", 0, ""],
        ["04/2025", 9002, "AUXILIAR E2E", "", "", "", 0, "OBRA B E2E"],
      ].map(linha),
    },
    {
      sheet: "Resumo",
      data: [
        ["Competência", "Total de proventos"],
        ["03/2025", 2980],
        ["04/2025", 2750],
      ].map(linha),
    },
  ]).toFile(arq);
  const { readFileSync } = await import("node:fs");
  return readFileSync(arq);
}

async function limpar() {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: "obra_e2e_carga" }).catch(() => {});
  await api.apagar("rubricas?codigo=eq.7777");
  await api.apagar("funcao_sinonimos?texto=eq.AUXILIAR%20E2E");
  await api.apagar("carga_rascunhos?titulo=like.*E2E*");
}

const continuar = (page: Page) => page.getByRole("button", { name: "Continuar →" }).click();

test.beforeAll(limpar);
test.afterAll(limpar);

test("engenharia não carrega obras", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/carga");
  await expect(
    page.getByText("Só DP/RH, controladoria ou um administrador carregam obras"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toHaveCount(0);
});

test("carga completa pelo DP/RH: folha .xlsx, mapeamento, rubrica nova, realocada e gravação", async ({
  page,
}) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/carga");

  // 1. Obra
  await page.getByLabel("Nome da obra").fill("Obra E2E Carga");
  await expect(page.getByLabel("Código da obra")).toHaveValue("obra_e2e_carga");
  await page.getByLabel("Área construída (m²)").fill("2.000");
  await page.getByLabel("Área construída (m²)").blur();
  await page.getByLabel("Tipologia").selectOption("Galpão logístico");
  // sem datas: a folha preenche o período
  expect(await semRolagemLateral(page)).toBe(true);
  await continuar(page);

  // 2. Arquivos: a folha é lida no navegador
  await page.getByLabel("Folha de pagamento com rubricas").setInputFiles({
    name: "folha_e2e.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await folhaXlsx(),
  });
  await expect(
    page.getByText("2 competências · 6 lançamentos · 2 matrículas · 3 rubricas"),
  ).toBeVisible();
  await expect(page.getByText("TRABALHADOR FICTICIO")).toHaveCount(0);
  await page.getByRole("button", { name: /^01 Obra/ }).click();
  await expect(page.getByLabel("Início da obra")).toHaveValue("2025-03");
  await expect(page.getByLabel("Término da obra")).toHaveValue("2025-04");
  await page.getByRole("button", { name: /^02 Arquivos/ }).click();
  await continuar(page);

  // 3. Funções: pedreiro reconhecido pelo nome; auxiliar mapeado para servente
  await expect(page.getByRole("row", { name: /^PEDREIRO / })).toContainText("reconhecida");
  await page.getByLabel("Função padrão para AUXILIAR E2E").selectOption({ label: "Servente" });
  await expect(page.getByRole("row", { name: /^AUXILIAR E2E / })).toContainText("mapeada agora");
  expect(await semRolagemLateral(page)).toBe(true);
  await continuar(page);

  // 4. Rubricas: a 7777 é nova e bloqueia até ser classificada
  await page.getByLabel("Tipo da rubrica 7777").selectOption("provento");
  await page.getByLabel("Componente da rubrica 7777").selectOption({ label: "Adicionais" });
  await expect(page.getByRole("row", { name: /^7777 / })).toContainText("nova · classificada");
  expect(await semRolagemLateral(page)).toBe(true);
  await continuar(page);

  // 5. Verificação
  const verif = page.getByRole("region", { name: "Verificação antes de salvar" });
  await expect(verif.locator('[data-verificacao="resumo"]')).toContainText("confere com o resumo");
  await expect(verif.locator('[data-verificacao="funcoes"]')).toContainText("OK");
  // destino da MDO realocada é obrigatório (o texto livre da folha precisa ser confirmado)
  await expect(verif.locator('[data-verificacao="realocada"]')).toContainText("Pendente");
  await expect(page.getByRole("button", { name: "Salvar na base histórica →" })).toBeDisabled();
  await page
    .getByLabel("Obra onde trabalharam (OBRA B E2E)")
    .selectOption({ label: "Obra fora da base: manter “OBRA B E2E”" });
  await expect(verif.locator('[data-verificacao="realocada"]')).toContainText("OK");
  expect(await semRolagemLateral(page)).toBe(true);

  await page.getByRole("button", { name: "Salvar na base histórica →" }).click();
  await expect(page).toHaveURL(/\/obras\/obra_e2e_carga$/);

  // no banco: efetivo derivado sem a MDO realocada, sinônimo e rubrica novos, nada de nome
  const api = await apiAdmin();
  const efetivo = await api.ler<{ funcao_id: string; mes_idx: number; equivalente: number }[]>(
    "efetivo_mes?obra_id=eq.obra_e2e_carga&order=funcao_id,mes_idx",
  );
  expect(efetivo.map((e) => [e.funcao_id, e.mes_idx, Number(e.equivalente)])).toEqual([
    ["ped", 0, 1],
    ["ped", 1, 1],
    ["serv", 0, 1],
  ]);
  const realoc = await api.ler<{ outra_obra: string; qtd: number }[]>(
    "realocacoes?obra_id=eq.obra_e2e_carga",
  );
  expect(realoc).toMatchObject([{ outra_obra: "OBRA B E2E", qtd: 1 }]);
  expect(await api.ler("funcao_sinonimos?texto=eq.AUXILIAR%20E2E")).toEqual([
    { texto: "AUXILIAR E2E", funcao_id: "serv" },
  ]);
  expect(await api.ler("rubricas?codigo=eq.7777&select=componente")).toEqual([
    { componente: "extras" },
  ]);
  const lanc = JSON.stringify(await api.ler("lancamentos?obra_id=eq.obra_e2e_carga"));
  expect(lanc).not.toMatch(/FICTICIO/);
  // o rascunho desta carga foi apagado ao gravar
  expect(await api.ler("carga_rascunhos?titulo=eq.Obra%20E2E%20Carga")).toEqual([]);
});

test("rascunho salvo sozinho: recarregar a página e continuar de onde parou", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/carga");
  await page.getByLabel("Nome da obra").fill("Rascunho E2E");
  await expect(page.getByText(/^Rascunho salvo /)).toBeVisible();
  await page.reload();
  const lista = page.getByRole("region", { name: "Rascunhos salvos" });
  await expect(lista).toContainText("Rascunho E2E");
  await lista.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Nome da obra")).toHaveValue("Rascunho E2E");
  await expect(page.getByLabel("Código da obra")).toHaveValue("rascunho_e2e");
});

test("modelo da folha no layout do ITO para baixar", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/carga");
  await page.getByLabel("Nome da obra").fill("Modelo E2E");
  await page.getByLabel("Área construída (m²)").fill("100");
  await page.getByLabel("Área construída (m²)").blur();
  await page.getByLabel("Tipologia").selectOption("Comercial");
  await continuar(page);
  const baixou = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar modelo" }).first().click();
  expect((await baixou).suggestedFilename()).toBe("modelo_folha_ito.xlsx");
});
