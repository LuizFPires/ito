import { describe, expect, it } from "vitest";
import { ehVersaoVelha } from "./versao";

describe("erro de versão velha", () => {
  it("reconhece arquivo da versão anterior em Chrome, Firefox e Safari", () => {
    expect(
      ehVersaoVelha(
        new TypeError("Failed to fetch dynamically imported module: https://x/assets/a.js"),
      ),
    ).toBe(true);
    expect(ehVersaoVelha(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(ehVersaoVelha(new TypeError("Importing a module script failed."))).toBe(true);
    expect(ehVersaoVelha(new Error("A obra não existe."))).toBe(false);
    expect(ehVersaoVelha(null)).toBe(false);
  });
});
