import { describe, expect, it } from "vitest";
import { nomeDe } from "./estado";

describe("nome da função criada a partir da folha (como no protótipo)", () => {
  it("até 3 palavras, sem ' de obra' no fim", () => {
    expect(nomeDe("TECNICO DE SEGURANÇA DO TRABALHO")).toBe("Tecnico de segurança");
    expect(nomeDe("MESTRE DE OBRA")).toBe("Mestre");
    expect(nomeDe("AUXILIAR E2E")).toBe("Auxiliar e2e");
  });
});
