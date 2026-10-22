import { defineConfig, devices } from "@playwright/test";

// e2e contra o Supabase local (pnpm db:start) e o Vite em dev.
export default defineConfig({
  testDir: "e2e",
  // Testes de um mesmo arquivo em série (escrevem nas mesmas linhas); arquivos em paralelo.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Vite em dev + vários navegadores em paralelo: 5 s ficam curtos quando a máquina carrega.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    locale: "pt-BR",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
