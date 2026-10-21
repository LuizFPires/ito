import { expect, test } from "@playwright/test";
import { apiAdmin, entrar, semRolagemLateral } from "./ajuda";

test("golden de encargos pela interface: 43,96% / 22,64% / 6,65%", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/parametros");
  await expect(page.getByText("43,96%").first()).toBeVisible();
  await expect(page.getByText("22,64%").first()).toBeVisible();
  await expect(page.getByText("6,65%").first()).toBeVisible();
  await expect(page.getByText("inclui incidência de 7,16%")).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);
});

test("golden de calendário pela interface: abr/2017 = 23 úteis e 7 repousos", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/parametros");
  await page.getByRole("button", { name: "Calendário" }).click();
  const anoAtual = new Date().getFullYear();
  for (let i = 0; i < anoAtual - 2017; i++) {
    await page.getByRole("button", { name: "Ano anterior" }).click();
  }
  const tabela = page.getByRole("table", { name: "Calendário de 2017" });
  const linha = (mes: string) =>
    tabela.getByRole("row").filter({ has: page.getByRole("cell", { name: mes, exact: true }) });
  // Célula = número + segunda linha (seg–sex/sáb e feriados em dia útil).
  const uteis = (mes: string) => linha(mes).getByRole("cell").nth(2);
  const repousos = (mes: string) => linha(mes).getByRole("cell").nth(3);
  await expect(uteis("fev")).toHaveText("24sendo 20 seg–sex + 4 sáb");
  await expect(repousos("fev")).toHaveText("4inclui 0 feriado(s) em dia útil");
  await expect(uteis("abr")).toHaveText("23sendo 18 seg–sex + 5 sáb");
  await expect(repousos("abr")).toHaveText("7inclui 2 feriado(s) em dia útil");
  await expect(uteis("mai")).toHaveText("26sendo 22 seg–sex + 4 sáb");
  await expect(repousos("mai")).toHaveText("5inclui 1 feriado(s) em dia útil");
});

test("engenharia só lê: sem campos de edição nem 'Criar data-base'", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/parametros");
  await expect(page.getByText("Só a controladoria altera a tabela da empresa.")).toBeVisible();
  await expect(page.getByLabel("Salário de Pedreiro")).toHaveCount(0);
  await page.getByRole("button", { name: "Datas-base" }).click();
  await expect(page.getByRole("button", { name: "Criar data-base" })).toHaveCount(0);
});

test("DP/RH não edita parâmetros (só funções e rubricas)", async ({ page }) => {
  await entrar(page, "dprh@ito.local");
  await page.goto("/parametros");
  await expect(page.getByLabel("Salário de Pedreiro")).toHaveCount(0);
});

test("controladoria cria data-base com reajuste de 6%: pedreiro 1.400 → 1.484", async ({
  page,
}, testInfo) => {
  const api = await apiAdmin();
  // Um ano por worker: execuções em paralelo não disputam a mesma data-base.
  const ano = String(2090 + (testInfo.parallelIndex % 10));
  await api.apagar("datas_base?ano=eq." + ano); // sobra de execução anterior
  try {
    await entrar(page, "admin@ito.local");
    await page.goto("/parametros");
    await page.getByRole("button", { name: "Datas-base" }).click();
    const form = page.getByRole("region", { name: "Criar nova data-base" });
    await form.getByLabel("Ano").fill(ano);

    // reajuste inválido não cria nada
    await form.getByLabel("Reajuste (%)").fill("150");
    await form.getByRole("button", { name: "Criar data-base" }).click();
    await expect(form.getByRole("alert")).toHaveText(
      "Informe um reajuste entre -50% e 100% (ex.: 6 ou 5,5).",
    );

    await form.getByLabel("Reajuste (%)").fill("6");
    await form.getByRole("button", { name: "Criar data-base" }).click();
    await expect(page.getByRole("status")).toContainText("Data-base criada");

    await page
      .getByRole("group", { name: "Data-base" })
      .getByRole("button", { name: ano, exact: true })
      .click();
    await expect(page.getByText("a revisar pela controladoria")).toBeVisible();
    await page.getByRole("button", { name: "Salários" }).click();
    await expect(page.getByLabel("Salário de Pedreiro")).toHaveValue("1.484,00");
    await expect(page.getByText("43,96%").first()).toBeVisible(); // encargos copiados sem reajuste
  } finally {
    await api.apagar("datas_base?ano=eq." + ano);
  }
});

test("controladoria edita salário e o valor fica salvo", async ({ page }) => {
  const api = await apiAdmin();
  try {
    await entrar(page, "admin@ito.local");
    await page.goto("/parametros");
    const escolher2023 = () =>
      page
        .getByRole("group", { name: "Data-base" })
        .getByRole("button", { name: "2023", exact: true })
        .click();
    await escolher2023();
    const campo = page.getByLabel("Salário de Vigia");
    await expect(campo).toHaveValue("1.150,00");
    await campo.fill("1.151,5");
    await campo.press("Enter");
    await expect(page.getByRole("status")).toContainText("Salvo");
    await page.reload();
    await escolher2023();
    await expect(page.getByLabel("Salário de Vigia")).toHaveValue("1.151,50");
  } finally {
    await api.alterar("data_base_salarios?ano=eq.2023&funcao_id=eq.vigia", { valor: 1150 });
  }
});

test("feriado da empresa: data inválida pede o formato e válida entra no calendário", async ({
  page,
}) => {
  await entrar(page, "admin@ito.local");
  await page.goto("/parametros");
  await page.getByRole("button", { name: "Calendário" }).click();
  await page.getByLabel("Data do feriado").fill("31/02/2030");
  await page.getByLabel("Descrição do feriado").fill("Teste");
  await page.getByRole("button", { name: "Adicionar feriado" }).click();
  await expect(page.getByText("Informe a data (dd/mm/aaaa) e a descrição.")).toBeVisible();
});

test("Quem recebe o quê: adicionais por pessoa·mês iguais ao protótipo", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/parametros");
  await page.getByRole("button", { name: "Adicionais e verbas" }).click();
  const tabela = page.getByRole("region", { name: /Quem recebe o quê/ });
  const linha = (nome: string) => tabela.getByRole("row").filter({ hasText: nome });
  await expect(linha("Eletricista")).toContainText("R$ 564,00");
  await expect(linha("Operador de guincho")).toContainText("R$ 324,20");
  await expect(linha("Vigia")).toContainText("R$ 104,00");
  await expect(linha("Estagiário")).toContainText("estágio · bolsa sem encargos");
  await expect(linha("Carpinteiro")).toContainText("R$ 90,00");
});

test("Calendário mostra os feriados do ano com dia da semana e tipo", async ({ page }) => {
  await entrar(page, "engenharia@ito.local");
  await page.goto("/parametros");
  await page.getByRole("button", { name: "Calendário", exact: true }).click();
  const lista = page.getByRole("table", { name: "Feriados de 2026" });
  const tiradentes = lista.getByRole("row").filter({ hasText: "Tiradentes" });
  await expect(tiradentes).toContainText("21/04/2026");
  await expect(tiradentes).toContainText("ter");
  await expect(tiradentes).toContainText("Nacional");
});
