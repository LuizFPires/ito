import { describe, expect, it } from "vitest";
import { detalheDoErro, rotaAnonima } from "./metricas";

describe("métricas sem dado pessoal (M14)", () => {
  it("rota sem o que identifica obra ou projeção", () => {
    expect(rotaAnonima("/obras/mm_paracatu/lancar")).toBe("/obras/:id/lancar");
    expect(rotaAnonima("/projecoes/3c95d179-1630-4280-b125-468b1fbd7a9e")).toBe("/projecoes/:id");
    expect(rotaAnonima("/projecoes/nova")).toBe("/projecoes/nova");
    expect(rotaAnonima("/base")).toBe("/base");
  });

  it("erro com a mensagem e o arquivo, sem a pilha", () => {
    const e = new TypeError("x is undefined");
    e.stack =
      "TypeError: x is undefined\n    at f (https://ito/assets/Resultado-ab12.js:3:99)\n    at g (outro.js:1:1)";
    expect(detalheDoErro(e)).toBe("x is undefined @ Resultado-ab12.js:3");
    expect(detalheDoErro("texto solto")).toBe("texto solto");
    expect(detalheDoErro(new Error("falhou para ana@x.com.br, matrícula 123456"))).toMatch(
      /^falhou para <e-mail> matrícula <n>( @ |$)/,
    );
    expect(detalheDoErro({ status: 404, statusText: "Not Found" })).toBe("404 Not Found");
    expect(detalheDoErro(new Error("a".repeat(500))).length).toBeLessThanOrEqual(300);
  });
});
