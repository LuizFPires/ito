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
  },
});
