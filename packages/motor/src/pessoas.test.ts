import { describe, expect, it } from "vitest";
import { pessoasInteiras } from "./projecao";

// Decisão do usuário (24/10/2026): a projeção nunca sugere pessoas fracionadas. Até ,2 arredonda
// para baixo; de ,3 em diante, para cima.
describe("pessoas inteiras na projeção", () => {
  it("até ,2 para baixo; acima de ,2 para cima", () => {
    expect(pessoasInteiras(1.1)).toBe(1);
    expect(pessoasInteiras(1.2)).toBe(1);
    expect(pessoasInteiras(1.3)).toBe(2);
    expect(pessoasInteiras(1.9)).toBe(2);
    expect(pessoasInteiras(3.2)).toBe(3);
    expect(pessoasInteiras(3.3)).toBe(4);
    expect(pessoasInteiras(1.25)).toBe(2);
  });
  it("inteiros, zero e ruído de ponto flutuante", () => {
    expect(pessoasInteiras(3)).toBe(3);
    expect(pessoasInteiras(0)).toBe(0);
    expect(pessoasInteiras(0.2)).toBe(0);
    expect(pessoasInteiras(0.3)).toBe(1);
    expect(pessoasInteiras(0.1 + 1.1)).toBe(1); // 1,2000000000000002
    expect(pessoasInteiras(2.9999999999)).toBe(3);
    expect(pessoasInteiras(-1)).toBe(0);
  });
});
