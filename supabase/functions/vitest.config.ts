import { defineConfig } from "vitest/config";

// M14: testes da lógica das Edge Functions (sem Deno: fetch e variáveis entram de fora)
export default defineConfig({
  test: { name: "funcoes", include: ["**/*.test.ts"] },
});
