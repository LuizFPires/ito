// M12: perfil de CPU de uma ação (servidor de desenvolvimento, nomes legíveis). Uso:
//   node perf/perfil.mjs resultado|obra
import { chromium } from "@playwright/test";
const alvo = process.argv[2] ?? "resultado";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const base = "http://localhost:5173";
await page.goto(base + "/entrar");
await page.getByLabel("E-mail").fill("admin@ito.local");
await page.getByLabel("Senha").fill("ito-dev-2026");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(/base/);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
if (alvo === "resultado") {
  await page.goto(base + "/projecoes/nova");
  await page.getByRole("textbox", { name: "Nome da projeção" }).fill("Perfil");
  await page.getByRole("combobox", { name: "Cidade da obra" }).selectOption("vespasiano");
  for (const [r, v] of [
    ["Área construída (m²)", "10000"],
    ["Prazo (meses)", "24"],
  ]) {
    const c = page.getByRole("textbox", { name: r, exact: true });
    await c.fill(v);
    await c.press("Tab");
  }
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("button", { name: /^Selecionar todas do filtro/ }).click();
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("img", { name: "Histograma previsto" }).waitFor();
  await cdp.send("Profiler.start");
  await page.getByRole("button", { name: /^06 Resultado/ }).click();
  await page.getByRole("table", { name: "Cenários de origem" }).waitFor({ timeout: 120000 });
} else {
  await cdp.send("Profiler.start");
  await page.goto(base + "/obras/perf_0001");
  await page.getByText("Pico de efetivo").first().waitFor();
}
const { profile } = await cdp.send("Profiler.stop");
const porId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = porId.get(id);
  const k = `${n.callFrame.functionName || "(anônima)"} ${n.callFrame.url.split("/").slice(-1)[0]}:${n.callFrame.lineNumber + 1}`;
  self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000);
});
const top = [...self]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 18)
  .map(([k, ms]) => ({ funcao: k, ms: Math.round(ms) }));
console.table(top);
await b.close();
