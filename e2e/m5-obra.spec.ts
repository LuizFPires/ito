import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiAdmin, entrar } from "./ajuda";

// Obra sintética (só matrícula): 3 meses, pedreiros, mestre e um servente realocado no 3º mês.
const OBRA = {
  obra: {
    id: "obra_e2e_detalhe",
    nome: "Obra E2E Detalhe",
    cliente: "Cliente E2E",
    tipologia: "Comercial",
    area_m2: 1500,
    inicio: "2025-03-01",
    meses: 3,
    data_base: 2025,
  },
  competencias: [0, 1, 2].map((mes_idx) => ({ mes_idx, he_media: 12, absenteismo_pct: 2 })),
  lancamentos: [0, 1, 2].flatMap((mes_idx) => [
    ...["201", "202"].map((matricula) => ({
      mes_idx,
      matricula,
      funcao_id: "ped",
      equivalente: 1,
      horas_extras: 10,
      admitido: mes_idx === 0,
      rubricas: [
        { codigo: 1, referencia: 220, valor: 1650 },
        { codigo: 200, referencia: 10, valor: 150 },
      ],
    })),
    {
      mes_idx,
      matricula: "203",
      funcao_id: "mestre",
      equivalente: 1,
      rubricas: [{ codigo: 1, referencia: 220, valor: 4200 }],
    },
    {
      mes_idx,
      matricula: "204",
      funcao_id: "serv",
      equivalente: 1,
      realocada_para: mes_idx === 2 ? "Outra obra E2E" : null,
      rubricas: [{ codigo: 1, referencia: 220, valor: 1100 }],
    },
  ]),
  realocacoes: [
    {
      tipo: "cedida",
      funcao_id: "serv",
      mes_ini: 2,
      mes_fim: 2,
      qtd: 1,
      outra_obra: "Outra obra E2E",
      saldo_vt: 50,
    },
  ],
};

async function limpar() {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: "obra_e2e_detalhe" }).catch(() => {});
}
test.beforeAll(async () => {
  await limpar();
  const api = await apiAdmin();
  await api.inserir("rpc/gravar_carga", { p: OBRA });
});
test.afterAll(limpar);

const aba = (page: Page, nome: string) => page.getByRole("tab", { name: nome }).click();
const kpi = (page: Page, rotulo: RegExp) =>
  page
    .locator("section")
    .filter({ has: page.getByText(rotulo) })
    .first();

test("as 10 abas abrem com os números da obra; dados por matrícula restritos", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/obras/obra_e2e_detalhe");
  await expect(page.getByRole("heading", { level: 1, name: "Obra E2E Detalhe" })).toBeVisible();
  // pico 4 (mar e abr: 2 ped + mestre + servente); pessoa-mês 11 (servente realocado em mai)
  await expect(kpi(page, /^Pico de efetivo$/)).toContainText("4,0 pessoas");
  await expect(kpi(page, /^Pessoa-mês$/)).toContainText("11,0");
  await expect(page.getByRole("img", { name: "Pessoas por função por mês" })).toBeVisible();

  await aba(page, "Efetivo");
  await expect(page.getByRole("table", { name: "Efetivo" })).toContainText(
    "Cedidos a Outra obra E2E",
  );
  await expect(page.getByText("A lista de matrículas é restrita")).toBeVisible();
  await aba(page, "Custos");
  await expect(page.getByRole("table", { name: "Custos" })).toContainText("Pedreiro");
  await aba(page, "Horas extras");
  await expect(page.getByRole("region", { name: "Leitura" })).toContainText("fizeram em média");
  await aba(page, "Folha (rubricas)");
  await expect(page.getByText("A folha por rubrica é restrita")).toBeVisible();
  await aba(page, "Pessoas");
  await expect(page.getByText("A lista de pessoas é restrita")).toBeVisible();
  await aba(page, "Apropriação");
  await expect(page.getByRole("table", { name: "Apropriação" })).toContainText("Total apropriado");
  await aba(page, "Indicadores");
  await expect(page.getByRole("region", { name: "Médias por função" })).toContainText("Mestre");
  await aba(page, "MDO realocada");
  await expect(page.getByRole("region", { name: "MDO realocada" })).toContainText("Outra obra E2E");
  await aba(page, "Premissas");
  await expect(page.getByLabel("Gratificações e prêmios (% do salário)")).toBeDisabled();
});

test("DP/RH vê folha, pessoas e matrículas; editar premissa recalcula o custo", async ({
  page,
}) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/obras/obra_e2e_detalhe?aba=folha");
  await expect(page.getByRole("table", { name: "Rubricas por mês" })).toContainText(
    "HORAS NORMAIS",
  );
  await expect(page.getByRole("region", { name: "MDO realocada nesta folha" })).toBeVisible();
  await aba(page, "Pessoas");
  await expect(page.getByText("Pessoas diferentes na obra")).toBeVisible();
  await expect(page.locator("td.mono", { hasText: "204" })).toBeVisible();
  await aba(page, "Efetivo");
  await page.getByRole("button", { name: "Pedreiro em mar/25: 2,0" }).click();
  await expect(page.getByRole("region", { name: "Matrículas do mês" })).toContainText("201");

  await aba(page, "Visão geral");
  const custo = kpi(page, /^Custo total · época$/);
  const antes = await custo.textContent();
  await aba(page, "Premissas");
  const grat = page.getByLabel("Gratificações e prêmios (% do salário)");
  await grat.fill("10,00");
  await grat.blur();
  await expect(page.getByText("Salvo")).toBeVisible();
  await aba(page, "Visão geral");
  await expect(custo).not.toHaveText(antes ?? "");
  // volta ao valor original
  await aba(page, "Premissas");
  await grat.fill("3,00");
  await grat.blur();
  await expect(page.getByText("Salvo").last()).toBeVisible();
});
