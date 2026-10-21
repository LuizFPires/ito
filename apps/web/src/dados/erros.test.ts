import { describe, expect, it } from "vitest";
import { mensagemErroBanco, mensagemErroCarga } from "./erros";

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
  it("pendências da carga dizem a etapa a corrigir", () => {
    const m = "Rubricas sem classificação: 7777. Classifique-as na etapa Rubricas.";
    expect(mensagemErroBanco({ code: "23503", message: m })).toBe(m);
    const nf = "Há nota fiscal sem competência. Escolha o mês de cada nota na verificação.";
    expect(mensagemErroBanco({ code: "23502", message: nf })).toBe(nf);
  });
  it("rede e desconhecido", () => {
    expect(mensagemErroBanco({ message: "Failed to fetch" })).toMatch(/conexão/);
    expect(mensagemErroBanco(null)).toMatch(/Tente de novo/);
  });
  it("gravação barrada pela RLS (nenhuma linha)", () => {
    expect(mensagemErroBanco({ code: "SEM_LINHAS" })).toMatch(/Nada foi gravado/);
  });
});

describe("mensagemErroCarga", () => {
  it("repassa a mensagem do banco que diz a etapa; traduz as genéricas da carga", () => {
    const m =
      "Há mês com diferença de apropriação × ERP sem justificativa. Justifique na verificação.";
    expect(mensagemErroCarga({ code: "23502", message: m })).toBe(m);
    expect(
      mensagemErroCarga({ code: "23505", message: "duplicate key notas_fiscais_pkey" }),
    ).toMatch(/repetido/);
    expect(mensagemErroCarga({ code: "23505", message: "obras_nome_unico" })).toMatch(/nome/);
    expect(mensagemErroCarga({ code: "23514", message: "check" })).toMatch(/fora do permitido/);
  });
});
