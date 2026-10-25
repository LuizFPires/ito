import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// M14: o site só fala com os dois projetos Supabase do ITO (produção e homologação, dos previews)
const aqui = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(aqui, "..", "..", "vercel.json"), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const cabecalho = (k: string) =>
  config.headers.find((h) => h.source === "/(.*)")!.headers.find((h) => h.key === k)?.value ?? "";

describe("cabeçalhos de segurança do site", () => {
  it("CSP sem curinga, com os hosts exatos do Supabase", () => {
    const csp = cabecalho("Content-Security-Policy");
    const conexao = /connect-src ([^;]+)/.exec(csp)![1]!;
    expect(conexao).not.toContain("*");
    expect(conexao).toContain("https://pntkdmzbuqvhypebbhhn.supabase.co");
    expect(conexao).toContain("https://rtciuljdjdvocxitaepz.supabase.co");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    // a descompactação e a gravação de .xlsx (fflate) criam workers de blob:; as fontes
    // pequenas vêm embutidas como data: (o build do Vite)
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toMatch(/script-src 'self';/);
  });

  it("HSTS de 2 anos e janela isolada", () => {
    expect(cabecalho("Strict-Transport-Security")).toMatch(/max-age=63072000/);
    expect(cabecalho("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });
});
