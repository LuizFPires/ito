import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

test("golden de VT por origem pela interface: Vespasiano R$ 11,00 local × R$ 24,80 vindo de BH", async ({
  page,
}) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/cidades");
  await page.getByRole("button", { name: /^Cidades/ }).click();
  await page.getByRole("searchbox", { name: "Buscar cidade" }).fill("vespasiano");
  const linha = page.getByRole("table", { name: "Cidades" }).getByRole("row").nth(1);
  await expect(linha).toContainText("VT local R$ 11,00/dia");
  await expect(linha).toContainText("VT R$ 24,80/dia");
  await expect(linha).not.toContainText("estimado");
  expect(await semRolagemLateral(page)).toBe(true);
});

test("engenharia só lê cidades e convenções", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/cidades");
  await expect(page.getByRole("button", { name: "+ Nova" })).toHaveCount(0);
  await expect(page.getByLabel(/^Salário de /)).toHaveCount(0);
  await page.getByRole("button", { name: /^Cidades/ }).click();
  await expect(page.getByLabel(/^Tarifa local de /)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Nova cidade" })).toHaveCount(0);
});

test("busca de convenção pela cidade coberta e salário comparado com a empresa", async ({
  page,
}) => {
  await entrar(page, "admin@ito.local");
  await page.goto("/cidades");
  await page.getByRole("searchbox", { name: "Buscar convenção ou cidade" }).fill("paracatu");
  const lista = page.getByRole("list", { name: "Convenções" });
  await expect(lista.getByRole("listitem")).toHaveCount(1);
  await lista.getByRole("button", { name: /Noroeste de Minas/ }).click();
  const editor = page.getByRole("region", { name: "Salários e gratificações por função" });
  // Noroeste = 0,93 × empresa, arredondado a R$ 10: pedreiro 1.300 (empresa 1.400 → −7,1%)
  await expect(editor.getByLabel("Salário de Pedreiro")).toHaveValue("1.300,00");
  await expect(editor.getByRole("row").filter({ hasText: "Pedreiro" })).toContainText("-7,1%");

  await page.getByLabel("Comparar com").selectOption({ label: "BH e região metropolitana" });
  await expect(
    editor.getByRole("columnheader", { name: "BH e região metropolitana" }),
  ).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);
});

test("comparar lado a lado: até 4, só leitura, menor salário marcado", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/cidades");
  await page.getByLabel("Comparar Construção civil · BH e região metropolitana").check();
  await page.getByLabel("Comparar Construção civil · Noroeste de Minas").check();
  await page.getByRole("button", { name: "Comparar lado a lado" }).click();
  const cmp = page.getByRole("region", { name: "Comparação de convenções" });
  const ped = cmp.getByRole("row").filter({ hasText: "Pedreiro" });
  await expect(ped).toContainText("R$ 1.400,00");
  await expect(ped).toContainText("R$ 1.300,00 menor");
  await expect(cmp.getByRole("row").filter({ hasText: "Funções com gratificação" })).toContainText(
    "mestre de obras",
  );
  await expect(cmp.locator("input")).toHaveCount(0);
});

test("controladoria: nova convenção, salário, lote, duplicar e excluir", async ({ page }) => {
  const api = await apiAdmin();
  const nome = `CCT e2e ${Date.now()}`;
  page.on("dialog", (d) => d.accept()); // confirmação do lote e da exclusão
  try {
    await entrar(page, "admin@ito.local");
    await page.goto("/cidades");
    await page.getByRole("button", { name: "+ Nova" }).click();
    await expect(page.getByRole("status")).toContainText("Convenção criada");
    const campoNome = page.getByLabel("Nome da convenção");
    await expect(campoNome).toHaveValue(/^Nova convenção/);
    await campoNome.fill(nome);
    await campoNome.blur();
    await expect(page.getByRole("status")).toContainText("Salvo");

    const editor = page.getByRole("region", { name: "Salários e gratificações por função" });
    await expect(editor.getByLabel("Salário de Pedreiro")).toHaveValue("1.400,00"); // tabela da empresa
    await editor.getByLabel("Salário de Pedreiro").fill("1.500");
    await editor.getByLabel("Salário de Pedreiro").press("Enter");
    await expect(page.getByRole("status")).toContainText("Salvo");

    await page.getByLabel("Percentual do ajuste em lote").fill("10");
    await page
      .getByRole("button", { name: "Aplicar a salários e gratificações desta CCT" })
      .click();
    await expect(editor.getByLabel("Salário de Pedreiro")).toHaveValue("1.650,00");

    await page.getByRole("button", { name: "Duplicar" }).click();
    await expect(page.getByLabel("Nome da convenção")).toHaveValue(`${nome} (cópia)`);
    await expect(editor.getByLabel("Salário de Pedreiro")).toHaveValue("1.650,00");

    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("status")).toContainText("Convenção excluída");
  } finally {
    for (const n of [nome, `${nome} (cópia)`])
      await api.apagar(`ccts?nome=eq.${encodeURIComponent(n)}`);
    await api.apagar(`ccts?nome=like.${encodeURIComponent("Nova convenção*")}`);
  }
});

test("comparar com CCT de nome longo não cria rolagem lateral (regra 8)", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/cidades");
  await page.getByRole("searchbox", { name: "Buscar convenção ou cidade" }).fill("rio doce");
  await page
    .getByRole("list", { name: "Convenções" })
    .getByRole("button", { name: /Vale do Rio Doce/ })
    .click();
  await page
    .getByLabel("Comparar com")
    .selectOption({ label: "Campo das Vertentes (São João del-Rei)" });
  await expect(
    page.getByRole("columnheader", { name: /Empresa · Campo das Vertentes/ }),
  ).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);
});

test("controladoria: nova cidade, passagem e feriado municipal", async ({ page }) => {
  const api = await apiAdmin();
  const nome = `Cidade e2e ${Date.now()}`;
  try {
    await entrar(page, "admin@ito.local");
    await page.goto("/cidades");
    await page.getByRole("button", { name: /^Cidades/ }).click();
    const nova = page.getByRole("region", { name: "Nova cidade" });
    await nova.getByLabel("Nome").fill(nome);
    await nova.getByLabel("Convenção").selectOption({ label: "BH e região metropolitana" });
    await nova.getByRole("button", { name: "Adicionar cidade" }).click();
    await expect(page.getByRole("status")).toContainText("Cidade adicionada");

    await page.getByRole("searchbox", { name: "Buscar cidade" }).fill(nome);
    const linha = page.getByRole("table", { name: "Cidades" }).getByRole("row").nth(1);
    await expect(linha).toContainText("VT local R$ 10,00/dia"); // tarifa 5 × 1 × 2
    await expect(linha).toContainText("(estimado)"); // (5 + 6,25) × 2 = 22,50
    await expect(linha).toContainText("VT R$ 22,50/dia");
    await linha.getByLabel(/^Passagem de Belo Horizonte/).fill("9");
    await linha.getByLabel(/^Passagem de Belo Horizonte/).press("Enter");
    await expect(linha).toContainText("VT R$ 18,00/dia");
    await expect(linha).not.toContainText("estimado");

    await linha.getByRole("button", { name: /Feriados e passagens/ }).click();
    const det = page.getByRole("region", { name: `Cidade ${nome}/MG` });
    await det.getByLabel("Dia e mês do feriado").fill("31/04");
    await det.getByLabel("Descrição do feriado municipal").fill("Não existe");
    await det.getByRole("button", { name: "Adicionar feriado" }).click();
    await expect(page.getByRole("status")).toContainText("Essa data não existe");
    await det.getByLabel("Dia e mês do feriado").fill("13/06");
    await det.getByLabel("Descrição do feriado municipal").fill("Santo Antônio");
    await det.getByRole("button", { name: "Adicionar feriado" }).click();
    await expect(det.getByText("13/06 Santo Antônio")).toBeVisible();
  } finally {
    await api.apagar(`cidades?nome=eq.${encodeURIComponent(nome)}`);
  }
});
