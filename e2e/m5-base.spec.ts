import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

// Obra sintética (só matrícula) gravada pela função da carga, como uma carga real.
const OBRA = {
  obra: {
    id: "obra_e2e_base",
    nome: "Obra E2E Base",
    cliente: "Cliente E2E",
    tipologia: "Galpão logístico",
    area_m2: 2000,
    inicio: "2025-03-01",
    meses: 3,
    data_base: 2025,
  },
  competencias: [0, 1, 2].map((mes_idx) => ({ mes_idx, he_media: 10, absenteismo_pct: 3 })),
  lancamentos: [0, 1, 2].flatMap((mes_idx) =>
    ["101", "102", "103"].map((matricula, j) => ({
      mes_idx,
      matricula,
      funcao_id: j === 2 ? "mestre" : "ped",
      equivalente: mes_idx === 2 && j === 1 ? 0.5 : 1,
      admitido: mes_idx === 0,
      rubricas: [{ codigo: 1, referencia: 220, valor: 1650 }],
    })),
  ),
};

const psql = (sql: string) =>
  execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_ito", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    {
      input: sql,
    },
  ).toString();

async function limpar() {
  const api = await apiAdmin();
  await api.inserir("rpc/excluir_obra", { p_id: "obra_e2e_base" }).catch(() => {});
  psql("delete from public.obras where id like 'perf\\_%';");
}

test.beforeAll(async () => {
  await limpar();
  const api = await apiAdmin();
  await api.inserir("rpc/gravar_carga", { p: OBRA });
});
test.afterAll(limpar);

test("engenharia vê a obra na base com o resumo calculado e abre o detalhe", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  const linha = page
    .getByRole("table", { name: "Obras" })
    .getByRole("row", { name: /Obra E2E Base/ });
  // pico 3 pessoas; pessoa-mês 8,5 (3 + 3 + 2,5)
  await expect(linha).toContainText("8,5");
  await expect(linha).toContainText("4,3 /1.000 m²");
  await expect(linha).toContainText("mar/25 – mai/25");
  await expect(linha).toContainText("92 dias");
  expect(await semRolagemLateral(page)).toBe(true);
  await page.getByRole("button", { name: "Galpões" }).click();
  await expect(linha).toBeVisible();
  await page.getByRole("searchbox", { name: "Filtrar obras" }).fill("não existe");
  await expect(page.getByText("Nenhuma obra neste filtro.")).toBeVisible();
  await page.getByRole("button", { name: "Ver todas" }).click();
  await linha.getByRole("link", { name: "Obra E2E Base" }).click();
  await expect(page).toHaveURL(/\/obras\/obra_e2e_base$/);
});

test("seleção para comparar e projetar", async ({ page }) => {
  await entrar(page, "planejamento@ito.local");
  await page.getByLabel("Selecionar Obra E2E Base").check();
  const barra = page.getByRole("region", { name: "Obras selecionadas" });
  await expect(barra).toContainText("1 obra selecionada");
  await expect(barra.getByRole("button", { name: "Comparar" })).toBeDisabled();
  await barra.getByRole("button", { name: "Projetar com estas →" }).click();
  await expect(page).toHaveURL(/\/projecoes\?refs=obra_e2e_base$/);
});

test("1.000 obras: a base carrega em menos de 2 s e pagina", async ({ page }) => {
  // DP/RH grava o resumo da obra de referência; as 1.000 cópias já nascem com resumo
  await entrar(page, "dprh@ito.local");
  await expect(page.getByRole("row", { name: /Obra E2E Base/ })).toContainText("4,3 /1.000 m²");
  psql(`
    insert into public.obras (id, nome, cliente, tipologia, area_m2, inicio, meses, data_base)
      select 'perf_' || g, 'Obra desempenho ' || lpad(g::text, 4, '0'), 'Cliente', 'Comercial',
             1000 + g, '2024-01-01', 12, 2025
      from generate_series(1, 1000) g;
    insert into public.obra_resumo (obra_id, vigente, versao, pico, pessoa_mes, he_por_pessoa,
      indireta_pct, custo_epoca, custo_atual, histograma)
      select 'perf_' || g, r.vigente, r.versao, r.pico, r.pessoa_mes, r.he_por_pessoa,
             r.indireta_pct, r.custo_epoca, r.custo_atual, r.histograma
      from generate_series(1, 1000) g, public.obra_resumo r where r.obra_id = 'obra_e2e_base';
  `);
  const t0 = Date.now();
  await page.goto("/base");
  await expect(page.getByText("1–25 de 1.001 obras")).toBeVisible();
  const ms = Date.now() - t0;
  console.info(`base com 1.001 obras: ${ms} ms`);
  expect(ms).toBeLessThan(2000);
  expect(await semRolagemLateral(page)).toBe(true);
  await page.getByRole("button", { name: "Próxima ›" }).click();
  await expect(page.getByText("26–50 de 1.001 obras")).toBeVisible();
});
