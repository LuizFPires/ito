import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { apiAdmin, entrar } from "./ajuda";

const OBRA = "exp_e2e";
const obra = {
  obra: {
    id: OBRA,
    nome: "Exportação E2E",
    cliente: "Cliente E2E",
    tipologia: "Galpão logístico",
    area_m2: 2000,
    inicio: "2025-01-01",
    meses: 2,
    data_base: 2025,
  },
  competencias: [0, 1].map((mes_idx) => ({ mes_idx, he_media: 10 })),
  lancamentos: [0, 1].flatMap((mes_idx) =>
    ["901", "902"].map((matricula) => ({
      mes_idx,
      matricula,
      funcao_id: "ped",
      equivalente: 1,
      rubricas: [{ codigo: 1, referencia: 220, valor: 1650 }],
    })),
  ),
};
let projecao = "";
let longa = "";

async function limpar() {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: OBRA }).catch(() => {});
  await api.apagar("projecoes?nome=like.E2E%20Exporta*");
}
test.beforeAll(async () => {
  await limpar();
  const api = await apiAdmin();
  await api.inserir("rpc/gravar_carga", { p: obra });
  const r = await api.inserir("projecoes", {
    nome: "E2E Exportação",
    inicio: "2027-03-01",
    prazo_meses: 3,
    area_m2: 1000,
    cidade_id: "vespasiano",
    quantidades_manuais: { ped: [2, 2, 2] },
  });
  void r;
  const [p] = await api.ler<{ id: string }[]>("projecoes?select=id&nome=eq.E2E%20Exportação");
  projecao = p!.id;
  await api.inserir("projecoes", {
    nome: "E2E Exportação longa",
    inicio: "2027-03-01",
    prazo_meses: 30,
    area_m2: 9000,
    cidade_id: "vespasiano",
    quantidades_manuais: {
      ped: Array.from({ length: 30 }, (_, i) => 4 + (i % 7)),
      serv: Array.from({ length: 30 }, (_, i) => 3 + (i % 5)),
    },
  });
  const [l] = await api.ler<{ id: string }[]>(
    "projecoes?select=id&nome=eq.E2E%20Exportação%20longa",
  );
  longa = l!.id;
});
test.afterAll(limpar);

/** Baixa pelo botão e abre o .xlsx: abas, primeira folha e estilos. */
async function baixar(page: Page, botao: string) {
  const [arq] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: botao }).click(),
  ]);
  const z = unzipSync(new Uint8Array(readFileSync((await arq.path())!)));
  const livro = strFromU8(z["xl/workbook.xml"]!);
  return {
    nome: arq.suggestedFilename(),
    abas: [...livro.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]),
    folha: (i: number) => strFromU8(z[`xl/worksheets/sheet${i}.xml`]!),
    estilos: strFromU8(z["xl/styles.xml"]!),
  };
}

test("obra para .xlsx: números com formato contábil BR; rubricas só para quem carrega", async ({
  page,
}) => {
  await entrar(page, "dprh@ito.local");
  await page.goto(`/obras/${OBRA}`);
  const x = await baixar(page, "Exportar .xlsx");
  expect(x.nome).toBe("ITO - Exportação E2E.xlsx");
  expect(x.abas).toEqual([
    "Efetivo",
    "Cabeças",
    "Custo por função",
    "Custo por componente",
    "Apropriação",
    "Rubricas",
  ]);
  // custo é número (sem t="s"), com o código contábil R$ no estilo
  // linha 7 = primeira função (4 linhas de título, linha em branco, cabeçalho); R$ em centavos
  expect(x.folha(3)).toMatch(/<c r="C7" s="\d+"><v>\d+(\.\d{1,2})?<\/v><\/c>/);
  expect(x.estilos).toContain("&quot;R$&quot; * #,##0.00");
  // rubricas agregadas: 2 matrículas × R$ 1.650 por mês, sem matrícula
  expect(x.folha(6)).toContain("<v>3300</v>");
  expect(x.folha(6)).not.toContain("901");

  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await entrar(page, "planejamento@ito.local");
  await page.goto(`/obras/${OBRA}`);
  const y = await baixar(page, "Exportar .xlsx");
  expect(y.abas).not.toContain("Rubricas");
});

test("copiar para Excel leva o texto tabulado no formato BR", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await entrar(page, "dprh@ito.local");
  await page.goto(`/obras/${OBRA}?aba=folha`);
  await page.getByRole("button", { name: "Copiar para Excel" }).click();
  await expect(page.getByText("Tabela copiada. Cole no Excel.")).toBeVisible();
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  expect(txt.split("\r\n")[0]).toContain("Código\tRubrica\tTipo");
  expect(txt).toContain("3.300,00");
});

test("projeção para .xlsx e resumo em PDF para a diretoria", async ({ page }) => {
  await entrar(page);
  await page.goto(`/projecoes/${projecao}`);
  const x = await baixar(page, "Exportar .xlsx");
  expect(x.nome).toBe("ITO - Projeção - E2E Exportação.xlsx");
  expect(x.abas).toEqual([
    "Premissas",
    "Efetivo",
    "Custo por função",
    "Custo por componente",
    "Trazer gente de fora",
    "Projeção × referências",
  ]);

  await page.getByRole("link", { name: "Resumo para a diretoria (PDF)" }).click();
  await expect(page).toHaveURL(new RegExp(`/projecoes/${projecao}/imprimir$`));
  await expect(page.getByRole("heading", { level: 1, name: "E2E Exportação" })).toBeVisible();
  await expect(page.getByLabel("Indicadores")).toContainText("R$");
  await expect(page.getByRole("navigation", { name: "Menu" })).toHaveCount(0);
  // na impressão, os botões somem e a página vira PDF
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toBeHidden();
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
});

test("resumo de uma obra de 30 meses cabe numa página A4", async ({ page }) => {
  await entrar(page);
  await page.goto(`/projecoes/${longa}/imprimir`);
  await expect(page.getByRole("heading", { level: 1, name: "E2E Exportação longa" })).toBeVisible();
  // meses agrupados (3 por linha): 10 períodos + total
  await expect(page.getByRole("columnheader", { name: "Período" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "mar/27 a mai/27" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const pdf = (await page.pdf({ format: "A4", margin: { top: "12mm", bottom: "12mm" } })).toString(
    "latin1",
  );
  expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
});
