import { describe, expect, it } from "vitest";
import {
  codigoDaObra,
  doCampoMes,
  faltasDaObra,
  fimDe,
  mesesEntre,
  paraCampoMes,
  periodoComFolha,
  rascunhoVazio,
} from "./estado";

describe("código da obra", () => {
  it("sem acento, minúsculo, com _", () => {
    expect(codigoDaObra("Mart Minas — Paracatu/MG")).toBe("mart_minas_paracatu_mg");
    expect(codigoDaObra("123 Galpão")).toBe("obra_123_galpao");
    expect(codigoDaObra("")).toBe("obra");
    expect(codigoDaObra("x".repeat(60))).toHaveLength(48);
  });
});

describe("período", () => {
  it("campo mês ↔ início; fim e meses", () => {
    expect(doCampoMes("2025-03")).toEqual({ ano: 2025, mes: 3 });
    expect(doCampoMes("2025-13")).toBeNull();
    expect(paraCampoMes({ ano: 2025, mes: 3 })).toBe("2025-03");
    expect(fimDe({ ano: 2025, mes: 11 }, 3)).toEqual({ ano: 2026, mes: 1 });
    expect(mesesEntre({ ano: 2025, mes: 11 }, { ano: 2026, mes: 1 })).toBe(3);
  });
});

describe("etapa Obra", () => {
  const vazio = rascunhoVazio(2025, new Date(2026, 9, 21));
  it("rascunho nasce na data-base vigente e sem período", () => {
    expect(vazio.dados).toMatchObject({ dataBase: 2025, meses: 0, inicio: { ano: 2026, mes: 10 } });
  });
  it("diz o que falta, com a ação", () => {
    expect(faltasDaObra(vazio.dados, [])).toEqual([
      "Informe o nome da obra.",
      "Escolha a tipologia.",
      "Informe a área construída (a partir de 100 m²).",
      "Informe início e término (o término não pode ser antes do início).",
    ]);
    const ok = {
      ...vazio.dados,
      nome: "Obra X",
      id: "obra_x",
      tipologia: "Comercial",
      area: 1000,
      meses: 5,
    };
    // sem datas pode ir aos Arquivos (a folha preenche), mas não adiante
    expect(faltasDaObra({ ...ok, meses: 0 }, [], false)).toEqual([]);
    expect(faltasDaObra({ ...ok, meses: 0 }, [])).toHaveLength(1);
    expect(faltasDaObra(ok, [])).toEqual([]);
    expect(faltasDaObra(ok, [{ id: "outra", nome: "obra x" }])[0]).toContain("Já existe");
  });
});

describe("obra em andamento (M11)", () => {
  const base = {
    ...rascunhoVazio(2025, new Date(2026, 0, 10)).dados,
    nome: "Obra Y",
    id: "obra_y",
    tipologia: "Comercial",
    area: 1000,
    situacao: "andamento" as const,
  };
  const linha = (ano: number, mes: number) => ({
    comp: { ano, mes },
    matricula: "1",
    funcao: "PEDREIRO",
    construtora: "classica" as const,
    codigo: 1,
    descricao: "SALARIO",
    referencia: 220,
    valor: 1500,
  });
  const folha = (...meses: [number, number][]) =>
    ({ rubricas: meses.map(([a, m]) => linha(a, m)), pessoas: [], resumo: [], erros: [] }) as never;

  it("basta o início; o prazo previsto vai de 1 a 120 meses", () => {
    expect(faltasDaObra(base, [])).toEqual([]);
    expect(faltasDaObra({ ...base, prazoPrevisto: 14 }, [])).toEqual([]);
    expect(faltasDaObra({ ...base, prazoPrevisto: 200 }, [])).toEqual([
      "O prazo previsto vai de 1 a 120 meses.",
    ]);
  });

  it("período do início informado até a última competência da folha", () => {
    // obra começou em jan/26; a folha enviada traz fev e mar
    expect(periodoComFolha(base, folha([2026, 2], [2026, 3])).meses).toBe(3);
    expect(periodoComFolha(base, folha([2026, 2], [2026, 3])).inicio).toEqual({
      ano: 2026,
      mes: 1,
    });
    // concluída sem datas: período da folha
    const concl = { ...base, situacao: "concluida" as const };
    expect(periodoComFolha(concl, folha([2026, 2], [2026, 3]))).toMatchObject({
      inicio: { ano: 2026, mes: 2 },
      meses: 2,
    });
  });
});
