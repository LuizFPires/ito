import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist",
      "**/coverage",
      "docs/prototipo",
      "playwright-report",
      "test-results",
      "@obsoletos",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Edge Functions (Deno): só o global Deno além do padrão web
    files: ["supabase/functions/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, Deno: "readonly" } },
  },
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Regra 3 do CLAUDE.md: texto exibido usa @ito/formato, nunca toFixed.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message: "Use numero/moeda/percentual de @ito/formato.",
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowExportNames: ["useSessao", "useToast"] },
      ],
    },
  },
  {
    // Motor e formatação são puros: nada de interface, rede ou banco.
    files: ["packages/motor/src/**/*.ts", "packages/formato/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-*", "@supabase/*", "@ito/web*"] },
      ],
      "no-restricted-globals": ["error", "fetch", "window", "document", "localStorage"],
    },
  },
);
