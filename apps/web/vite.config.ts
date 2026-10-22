import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // Núcleo (React, Router, Query, supabase-js) ≈ 170 kB gzip; telas já vêm sob demanda.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // testes unitários não falam com o banco: valores fixos, sem depender do .env.local
    // (no CI ele só é criado depois, para o build e o e2e)
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "chave-de-teste",
    },
  },
});
