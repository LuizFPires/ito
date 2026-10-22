import { describe, expect, it } from "vitest";
import { diferencas, rotuloRegistro, valorAuditado } from "./auditoria";

describe("auditoria", () => {
  it("diferenças só nos campos que mudaram, sem os técnicos", () => {
    expect(
      diferencas(
        { valor: 1650, nome: "Pedreiro", atualizado_em: "2026-10-01T10:00:00Z" },
        { valor: 1716, nome: "Pedreiro", atualizado_em: "2026-10-02T10:00:00Z" },
      ),
    ).toEqual([{ campo: "valor", antes: 1650, depois: 1716 }]);
  });

  it("criação e exclusão mostram os campos preenchidos", () => {
    expect(diferencas(null, { id: "x", nome: "Nova", cliente: null })).toEqual([
      { campo: "id", antes: undefined, depois: "x" },
      { campo: "nome", antes: undefined, depois: "Nova" },
    ]);
    expect(diferencas({ id: "x", obs: "" }, null)).toEqual([
      { campo: "id", antes: "x", depois: undefined },
    ]);
  });

  it("valores no formato brasileiro", () => {
    expect(valorAuditado(1716.5)).toBe("1.716,5");
    expect(valorAuditado(43.96)).toBe("43,96");
    expect(valorAuditado(12000)).toBe("12.000");
    expect(valorAuditado(2026, "ano")).toBe("2026");
    expect(valorAuditado("2026-05-01")).toBe("01/05/2026");
    expect(valorAuditado(true)).toBe("sim");
    expect(valorAuditado(null)).toBe("—");
    expect(valorAuditado(["ped", "serv"])).toBe("ped, serv");
    expect(valorAuditado([{ a: 1 }, { a: 2 }])).toBe("2 itens");
  });

  it("rótulo do registro pela chave", () => {
    expect(rotuloRegistro({ ano: 2025, funcao_id: "ped" })).toBe("2025 · ped");
  });
});
