import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { entrar } from "../e2e/ajuda";

// M12 — baseline de desempenho da tela, sobre o build de produção e as 1.000 obras sintéticas do
// M10 (pnpm desempenho gerar). Mede tempos de abertura, latência de cada mexida no histograma da
// projeção (do evento ao quadro pintado) e tarefas longas (> 50 ms) do navegador.
// Uso: pnpm perf. Grava docs/performance/tela.json.

interface Linha {
  caso: string;
  mediana: number;
  p95: number;
  n: number;
}
const linhas: Linha[] = [];
const ARQ = "docs/performance/tela.json";

function registrar(caso: string, tempos: number[]) {
  const t = [...tempos].sort((a, b) => a - b);
  const q = (p: number) => Math.round(t[Math.min(t.length - 1, Math.floor(p * t.length))]!);
  linhas.push({ caso, mediana: q(0.5), p95: q(0.95), n: t.length });
  console.info(`${caso}: mediana ${q(0.5)} ms · p95 ${q(0.95)} ms (n=${t.length})`);
}

/** Tarefas longas e LCP observados desde o carregamento da página. */
async function observar(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __longas: number[]; __lcp: number };
    w.__longas = [];
    w.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__longas.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}
const longas = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __longas: number[] };
    const l = w.__longas.splice(0);
    return {
      qtd: l.length,
      total: Math.round(l.reduce((a, b) => a + b, 0)),
      maior: Math.round(Math.max(0, ...l)),
    };
  });

/** Muda um campo como o usuário (evento input) e mede até o próximo quadro pintado. */
async function mexer(page: Page, rotulo: string, valor: string) {
  return page.evaluate(
    async ({ rotulo, valor }) => {
      const el = document.querySelector(`[aria-label="${rotulo}"]`) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      const t0 = performance.now();
      setter.call(el, valor);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    },
    { rotulo, valor },
  );
}

async function cronometrar(fn: () => Promise<void>) {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
}

test.beforeAll(() => {
  // as 1.000 obras do M10 precisam existir
  mkdirSync("docs/performance", { recursive: true });
});

test.afterAll(() => {
  let anterior: unknown = null;
  try {
    anterior = JSON.parse(readFileSync(ARQ, "utf8"));
  } catch {
    // primeira medição
  }
  writeFileSync(
    ARQ,
    JSON.stringify(
      { medidoEm: new Date().toISOString(), linhas, anterior: anterior ?? undefined },
      null,
      2,
    ) + "\n",
  );
});

test("base histórica e detalhe da obra (1.000 obras)", async ({ page }) => {
  await observar(page);
  await entrar(page, "admin@ito.local");
  const tempos: number[] = [];
  for (let i = 0; i < 3; i++)
    tempos.push(
      await cronometrar(async () => {
        await page.goto("/base");
        await expect(page.getByRole("navigation", { name: "Páginas de obras" })).toContainText(
          /de 1\.\d{3} obras/,
        );
      }),
    );
  registrar("base: abrir com 1.000 obras", tempos);
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);
  registrar("base: LCP", [lcp]);
  const lb = await longas(page);
  registrar("base: tarefas longas (total por abertura)", [lb.total / 3]);

  const obra: number[] = [];
  for (let i = 0; i < 3; i++)
    obra.push(
      await cronometrar(async () => {
        await page.goto(`/obras/perf_000${i + 1}`);
        await expect(page.getByRole("tablist", { name: "Abas da obra" })).toBeVisible();
        await expect(page.getByText("Pico de efetivo").first()).toBeVisible();
      }),
    );
  registrar("obra: abrir detalhe pelo endereço (carrega o app)", obra);

  const noApp: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.goto("/base");
    await expect(page.getByRole("navigation", { name: "Páginas de obras" })).toBeVisible();
    noApp.push(
      await cronometrar(async () => {
        await page
          .getByRole("link", { name: /^Obra Desempenho/ })
          .nth(i)
          .click();
        await expect(page.getByRole("tablist", { name: "Abas da obra" })).toBeVisible();
        await expect(
          page
            .getByRole("region", { name: "Indicadores da obra" })
            .or(page.getByText("Custo total").first()),
        ).toBeVisible();
      }),
    );
  }
  registrar("obra: abrir pela base (app já aberto)", noApp);
  const lo = await longas(page);
  registrar("obra: maior tarefa longa", [lo.maior]);

  const aba: number[] = [];
  for (const a of ["Custos", "Horas extras", "Indicadores", "Visão geral"])
    aba.push(
      await cronometrar(async () => {
        await page.getByRole("tab", { name: a }).click();
        await expect(page.getByRole("tab", { name: a })).toHaveAttribute("aria-selected", "true");
      }),
    );
  registrar("obra: trocar de aba", aba);
});

async function novaProjecao(page: Page) {
  await page.goto("/projecoes/nova");
  await page.getByRole("textbox", { name: "Nome da projeção" }).fill("Perf baseline");
  await page.getByRole("combobox", { name: "Cidade da obra" }).selectOption("vespasiano");
  for (const [r, v] of [
    ["Área construída (m²)", "10000"],
    ["Prazo (meses)", "24"],
  ] as const) {
    const c = page.getByRole("textbox", { name: r, exact: true });
    await c.fill(v);
    await c.press("Tab");
  }
  await page.getByRole("button", { name: "Continuar →" }).click();
}

async function histograma(page: Page, nome: string) {
  await expect(page.getByRole("table", { name: "Pessoas por função e mês" })).toBeVisible();
  const funcao = await page.getByRole("slider").first().getAttribute("aria-label");
  const regua: number[] = [];
  for (let i = 0; i < 10; i++) regua.push(await mexer(page, funcao!, String(i % 2 ? 20 : -20)));
  registrar(`${nome}: régua (do evento ao quadro)`, regua);
  const celula = (await page
    .getByRole("textbox", { name: / em / })
    .first()
    .getAttribute("aria-label"))!;
  const digitar: number[] = [];
  for (let i = 0; i < 10; i++) digitar.push(await mexer(page, celula, String(3 + (i % 5))));
  registrar(`${nome}: digitar um mês (do evento ao quadro)`, digitar);
  const l = await longas(page);
  registrar(`${nome}: maior tarefa longa`, [l.maior]);
}

test("projeção: histograma com 5 e com 1.000 referências (24 meses)", async ({ page }) => {
  await observar(page);
  await entrar(page, "admin@ito.local");

  await novaProjecao(page);
  await page.getByRole("button", { name: "Selecionar as 5 mais parecidas" }).click();
  registrar("projeção · 5 refs: abrir o histograma", [
    await cronometrar(async () => {
      await page.getByRole("button", { name: "Continuar →" }).click();
      await expect(page.getByRole("img", { name: "Histograma previsto" })).toBeVisible();
    }),
  ]);
  await histograma(page, "projeção · 5 refs");
  registrar("projeção · 5 refs: abrir o resultado", [
    await cronometrar(async () => {
      await page.getByRole("button", { name: /^06 Resultado/ }).click();
      await expect(page.getByRole("table", { name: "Cenários de origem" })).toBeVisible();
    }),
  ]);

  await novaProjecao(page);
  const todas = page.getByRole("button", { name: /^Selecionar todas do filtro/ });
  await expect(todas).toBeEnabled();
  registrar("projeção · todas as refs: abrir o histograma", [
    await cronometrar(async () => {
      await todas.click();
      await page.getByRole("button", { name: "Continuar →" }).click();
      await expect(page.getByRole("img", { name: "Histograma previsto" })).toBeVisible();
    }),
  ]);
  // M14: o mesmo tempo medido dentro do app (useTempoDeTela), sem a espera do Playwright
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("ito:abrir histograma").length))
    .toBeGreaterThan(0);
  registrar("projeção · todas as refs: abrir o histograma (medido no app)", [
    await page.evaluate(
      () => performance.getEntriesByName("ito:abrir histograma").at(-1)!.duration,
    ),
  ]);
  await histograma(page, "projeção · todas as refs");
  registrar("projeção · todas as refs: abrir o resultado", [
    await cronometrar(async () => {
      await page.getByRole("button", { name: /^06 Resultado/ }).click();
      await expect(page.getByRole("table", { name: "Cenários de origem" })).toBeVisible();
    }),
  ]);
});
