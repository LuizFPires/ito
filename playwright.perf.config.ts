import { defineConfig, devices } from "@playwright/test";

// M12: medição de desempenho sobre o build de produção (vite preview), fora da suíte normal.
// Uso: pnpm perf (gera o build, sobe o preview e grava docs/performance/tela.json).
export default defineConfig({
  testDir: "perf",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 60_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    locale: "pt-BR",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command:
      "pnpm --filter @ito/web build && pnpm --filter @ito/web preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
