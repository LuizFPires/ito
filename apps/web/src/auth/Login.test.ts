import { describe, expect, it } from "vitest";
import { mensagemDeErro } from "./mensagens";

describe("mensagemDeErro", () => {
  it("credencial errada diz o que fazer", () => {
    expect(mensagemDeErro("invalid_credentials", "Invalid login credentials")).toBe(
      "E-mail ou senha incorretos. Confira e tente de novo.",
    );
  });
  it("sem rede", () => {
    expect(mensagemDeErro(undefined, "Failed to fetch")).toMatch(/Sem conexão/);
  });
  it("erro desconhecido tem saída", () => {
    expect(mensagemDeErro("xyz", "boom")).toMatch(/controladoria/);
  });
});
