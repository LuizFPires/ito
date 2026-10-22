import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(aqui, "tokens.css"), "utf8");

function bloco(seletor: string): Record<string, string> {
  const i = css.indexOf(seletor);
  if (i < 0) throw new Error(`seletor não encontrado: ${seletor}`);
  const ini = css.indexOf("{", i);
  const fim = css.indexOf("}", ini);
  const out: Record<string, string> = {};
  for (const m of css.slice(ini + 1, fim).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const claro = bloco(":root {");
const escuroSistema = bloco(':root:not([data-theme="light"])');
const escuroEscolhido = bloco(':root[data-theme="dark"]');
const escuro = { ...claro, ...escuroEscolhido };

function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe("tokens do Canteiro", () => {
  it("cores da marca conforme o CLAUDE.md", () => {
    expect(claro["--amber"]).toBe("#f2b705");
    expect(claro["--active-bg"]).toBe("#1f2226");
    expect(claro["--amber-text"]).toBe("#8a6400");
  });

  it("escuro do sistema e escuro escolhido são idênticos", () => {
    expect(escuroSistema).toEqual(escuroEscolhido);
  });

  it("todo token de cor do escuro existe no claro", () => {
    for (const k of Object.keys(escuroEscolhido)) expect(claro).toHaveProperty(k);
  });

  const pares: [string, string, number][] = [
    ["--ink", "--bg", 7],
    ["--body", "--surface", 4.5],
    ["--muted", "--surface", 4.5],
    ["--amber-text", "--surface", 4.5],
    ["--amber-text", "--amber-tint", 4.5],
    ["--active-fg", "--active-bg", 4.5],
    ["--on-amber", "--amber", 4.5],
    ["--ok", "--ok-tint", 4.5],
    ["--err", "--err-tint", 4.5],
  ];

  for (const [modo, t] of [
    ["claro", claro],
    ["escuro", escuro],
  ] as const) {
    it.each(pares)(`contraste AA no ${modo}: %s sobre %s`, (fg, bg, min) => {
      expect(contraste(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
    });
  }
});
