import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

// Duas obras sintéticas (só matrícula) para servir de referência.
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
      matricula: `${800 + j}`,
      funcao_id: "ped",
      equivalente: 1,
      rubricas: [{ codigo: 1, referencia: 220, valor: 1650 }],
    })),
  ).flat(),
});

async function limpar() {
  const api = await apiAdmin();
  // só as projeções deste arquivo (outros arquivos e2e rodam em paralelo)
  const ps = await api.ler<{ id: string }[]>(
    "projecoes?select=id&or=(nome.like.E2E%20Golden*,nome.like.E2E%20Refs*)",
  );
  for (const p of ps) {
    // aprovada não se apaga: admin volta para Em análise antes
    await api.inserir("rpc/definir_situacao", { p_id: p.id, p_situacao: "em_analise" });
    await api.apagar(`projecoes?id=eq.${p.id}`);
  }
  for (const id of ["proj_e2e_a", "proj_e2e_b"])
    await api.inserir("rpc/excluir_obra", { p_id: id }).catch(() => {});
}
test.beforeAll(async () => {
  await limpar();
  const api = await apiAdmin();
  await api.inserir("rpc/gravar_carga", { p: obra("proj_e2e_a", "Projeção E2E Ref A", 4, 3) });
  await api.inserir("rpc/gravar_carga", { p: obra("proj_e2e_b", "Projeção E2E Ref B", 6, 5) });
});
test.afterAll(limpar);

async function numeroCampo(page: Page, rotulo: string, valor: string) {
  const c = page.getByRole("textbox", { name: rotulo, exact: true });
  await c.fill(valor);
  await c.press("Tab");
}

async function passoObra(page: Page, nome: string) {
  await page.getByRole("textbox", { name: "Nome da projeção" }).fill(nome);
  await page.getByRole("combobox", { name: "Cidade da obra" }).selectOption("vespasiano");
  await page.getByRole("combobox", { name: "Início previsto" }).selectOption({ label: "mar/27" });
  await numeroCampo(page, "Área construída (m²)", "4800");
  await numeroCampo(page, "Prazo (meses)", "9");
}

test("golden pela tela: reajuste da CCT em mai/27 e VT de quem vem de BH todo dia", async ({
  page,
}) => {
  const inicio = Date.now();
  await entrar(page);
  await page.goto("/projecoes/nova");
  await passoObra(page, "E2E Golden Vespasiano");
  const precos = page.getByRole("region", { name: "Preços de Vespasiano/MG" });
  await expect(precos).toContainText("Oficial R$ 1.400,00");
  await expect(precos).toContainText("VT local R$ 11,00 por dia");
  await page.getByRole("button", { name: "Continuar →" }).click();

  // quantidades informadas: 5 pedreiros por mês
  await page.getByRole("button", { name: "Informar quantidades →" }).click();
  for (const m of ["mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov"])
    await numeroCampo(page, `Pedreiro em ${m}/27`, "5");
  await expect(page.getByRole("region", { name: "Reajuste e calendário no prazo" })).toContainText(
    "Ela cai em mai/27: os meses seguintes saem com 6,0% de reajuste estimado",
  );
  const origem = page.getByRole("region", { name: "Origem da mão de obra" });
  const pedreiro = origem.getByRole("row", { name: /Pedreiro/ });
  await expect(pedreiro).toContainText("R$ 11,00");
  await pedreiro.getByRole("button", { name: "Vem de BH todo dia" }).click();
  await expect(pedreiro).toContainText("R$ 24,80");

  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByRole("region", { name: "Premissas aplicadas" })).toContainText(
    "Reajuste de 6,0% a partir de mai/27 (data-base da CCT)",
  );
  await expect(page.getByRole("table", { name: "Custo por mês" })).toContainText(
    "R$ 1.400,00 → R$ 1.484,00 em mai/27",
  );
  const cenarios = page.getByRole("table", { name: "Cenários de origem" });
  await expect(cenarios).toContainText("Toda a mão de obra local");
  await expect(cenarios).toContainText("Toda vindo de Belo Horizonte/MG todo dia");
  expect(await semRolagemLateral(page)).toBe(true);
  await page.getByRole("button", { name: "Salvar projeção →" }).first().click();

  await expect(page).toHaveURL(/\/projecoes\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E Golden Vespasiano" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Premissas aplicadas" })).toContainText(
    "Reajuste de 6,0% a partir de mai/27",
  );
  // uma projeção completa em bem menos de 10 minutos (aceite do M7)
  expect(Date.now() - inicio).toBeLessThan(10 * 60 * 1000);
});

test("referências da base, lista, situação, duplicar e comparar", async ({ page }) => {
  await entrar(page);
  await page.getByRole("searchbox", { name: "Filtrar obras" }).fill("Projeção E2E Ref");
  await page.getByLabel("Selecionar Projeção E2E Ref A").check();
  await page.getByLabel("Selecionar Projeção E2E Ref B").check();
  await page.getByRole("button", { name: "Projetar com estas →" }).click();
  await expect(page).toHaveURL(/\/projecoes\/nova\?refs=/);

  await passoObra(page, "E2E Refs Galpão");
  await page.getByRole("button", { name: "Continuar →" }).click();
  const sel = page.getByRole("region", { name: "Referências selecionadas" });
  await expect(sel).toContainText("Selecionadas (2)");
  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByRole("table", { name: "Ajustes por função" })).toContainText("Pedreiro");
  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByRole("table", { name: "Projeção e obras de referência" })).toContainText(
    "Projeção E2E Ref B",
  );
  await page.getByRole("button", { name: "Salvar projeção →" }).first().click();
  await expect(page).toHaveURL(/\/projecoes\/[0-9a-f-]{36}$/);

  // situação: planejamento põe em análise, mas não aprova
  const situacao = page.getByRole("group", { name: "Situação" });
  await expect(situacao.getByRole("button", { name: "Aprovada" })).toBeDisabled();
  await situacao.getByRole("button", { name: "Em análise" }).click();
  await expect(situacao.getByRole("button", { name: "Em análise" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // duplicar abre a cópia em rascunho
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E Refs Galpão (cópia)" }),
  ).toBeVisible();

  // lista: filtro por situação e comparação
  await page.goto("/projecoes");
  await page.getByRole("searchbox", { name: "Filtrar projeções" }).fill("E2E Refs");
  const lista = page.getByRole("table", { name: "Lista de projeções" });
  await expect(lista.getByRole("row")).toHaveCount(3);
  await page
    .getByRole("group", { name: "Situação" })
    .getByRole("button", { name: /Em análise/ })
    .click();
  await expect(lista.getByRole("row")).toHaveCount(2);
  await page
    .getByRole("group", { name: "Situação" })
    .getByRole("button", { name: /Todas/ })
    .click();
  expect(await semRolagemLateral(page)).toBe(true);
  await page.getByLabel("Selecionar E2E Refs Galpão", { exact: true }).check();
  await page.getByLabel("Selecionar E2E Refs Galpão (cópia)").check();
  await page.getByRole("button", { name: "Comparar cenários →" }).click();
  await expect(page).toHaveURL(/\/projecoes\/comparar\?ids=/);
  const cmp = page.getByRole("table", { name: "Comparação de projeções" });
  await expect(cmp).toContainText("E2E Refs Galpão (cópia)");
  await expect(cmp.getByRole("row", { name: /Diferença de custo/ })).toContainText("+R$ 0");
});

test("diretoria aprova; aprovada não é editada", async ({ page }) => {
  const api = await apiAdmin();
  const [p] = await api.ler<{ id: string }[]>(
    "projecoes?select=id&nome=eq.E2E%20Golden%20Vespasiano",
  );
  await entrar(page, "diretoria@ito.local");
  await page.goto(`/projecoes/${p!.id}`);
  await expect(page.getByRole("button", { name: "Editar premissas →" })).toHaveCount(0);
  const situacao = page.getByRole("group", { name: "Situação" });
  await situacao.getByRole("button", { name: "Aprovada" }).click();
  await expect(situacao.getByRole("button", { name: "Aprovada" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // planejamento vê a aprovada travada
  await page.getByRole("button", { name: "Conta e aparência" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await entrar(page);
  await page.goto(`/projecoes/${p!.id}`);
  await expect(page.getByRole("button", { name: "Editar premissas →" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apagar" })).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Situação" }).getByRole("button", { name: "Em análise" }),
  ).toBeDisabled();
});

test("referências: selecionar todas as obras do filtro de uma vez", async ({ page }) => {
  await entrar(page);
  await page.goto("/projecoes/nova");
  await passoObra(page, "E2E Todas do filtro");
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("searchbox", { name: "Buscar obra de referência" }).fill("Projeção E2E Ref");
  await page.getByRole("button", { name: "Selecionar todas do filtro (2)" }).click();
  await expect(page.getByRole("region", { name: "Referências selecionadas" })).toContainText(
    "Selecionadas (2)",
  );
  await expect(page.getByRole("button", { name: /^Selecionar todas do filtro/ })).toBeDisabled();
});
