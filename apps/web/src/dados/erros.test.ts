import { describe, expect, it } from "vitest";
import { mensagemErroBanco } from "./erros";

describe("mensagemErroBanco", () => {
  it("permissão negada pela RLS", () => {
    expect(mensagemErroBanco({ code: "42501", message: "x" })).toMatch(/permissão/);
  });
  it("mensagens próprias do banco são repassadas", () => {
    expect(
      mensagemErroBanco({
        code: "23505",
        message: "A data-base 2027 já existe. Escolha outro ano.",
      }),
    ).toBe("A data-base 2027 já existe. Escolha outro ano.");
    expect(
      mensagemErroBanco({ code: "22023", message: "Informe um reajuste entre -50% e 100%." }),
    ).toBe("Informe um reajuste entre -50% e 100%.");
  });
  it("duplicado genérico e cadastro em uso", () => {
    expect(mensagemErroBanco({ code: "23505", message: "duplicate key" })).toMatch(/Use outro/);
    expect(mensagemErroBanco({ code: "23503", message: "fk" })).toMatch(/Inative/);
  });
  it("rede e desconhecido", () => {
    expect(mensagemErroBanco({ message: "Failed to fetch" })).toMatch(/conexão/);
    expect(mensagemErroBanco(null)).toMatch(/Tente de novo/);
  });
});
