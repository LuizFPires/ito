import { describe, expect, it } from "vitest";
import { CADASTRO, CTX, DADOS, FOLHA, TABELA } from "./fixtures";
import type { LeituraFolha } from "./leitores";
import { encaixarMes, mesParaGravar } from "./mes";
import type { Escolhas } from "./montagem";
import { ESCOLHAS_VAZIAS, montarCarga } from "./montagem";
import { verificarCarga } from "./verificacoes";

// a mesma folha da carga, lançada mês a mês, tem de dar a mesma obra da carga inteira
const so = (mes: number): LeituraFolha => ({
  ...FOLHA,
  rubricas: FOLHA.rubricas.filter((l) => l.comp.mes === mes),
  pessoas: FOLHA.pessoas.filter((l) => l.comp.mes === mes),
  resumo: FOLHA.resumo.filter((l) => l.comp.mes === mes),
});
const escolhas: Escolhas = {
  ...ESCOLHAS_VAZIAS,
  rubricasNovas: {
    7777: {
      nome: "PRÊMIO ASSIDUIDADE",
      tipo: "provento",
      componente: "extras",
      baseProvisoes: true,
      tipoHe: null,
    },
  },
  realocacao: { "OBRA B": { nome: "Obra B", obraId: null } },
};

describe("lançar mês na obra em andamento", () => {
  const inteira = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, escolhas, TABELA);
  const mar = montarCarga({ ...DADOS, meses: 1 }, { folha: so(3) }, CADASTRO, escolhas, TABELA);
  const abr = montarCarga(
    { ...DADOS, inicio: { ano: 2025, mes: 4 }, meses: 1 },
    { folha: so(4) },
    CADASTRO,
    escolhas,
    TABELA,
  );
  const m = encaixarMes({ obra: mar.obra, movimentos: mar.movimentos }, abr, 1);

  it("o mês encaixado reproduz a carga da obra inteira", () => {
    expect(m.obra.meses).toBe(2);
    expect(m.obra.inicio).toEqual(DADOS.inicio);
    expect(m.obra.equivalente).toEqual(inteira.obra.equivalente);
    expect(m.obra.cabecas).toEqual(inteira.obra.cabecas);
    expect(m.obra.heMedia).toEqual(inteira.obra.heMedia);
    expect(m.obra.absenteismoPct).toEqual(inteira.obra.absenteismoPct);
    expect(m.movimentos).toEqual(inteira.movimentos);
    expect(m.payload.lancamentos).toEqual(
      inteira.payload.lancamentos.filter((l) => l.mes_idx === 1),
    );
    expect(m.payload.realocacoes).toEqual(inteira.payload.realocacoes);
  });

  it("refazer um mês substitui só ele", () => {
    const refeito = encaixarMes({ obra: m.obra, movimentos: m.movimentos }, mar, 0);
    expect(refeito.obra.meses).toBe(2);
    expect(refeito.obra.equivalente).toEqual(inteira.obra.equivalente);
  });

  it("a verificação confere só o mês lançado", () => {
    const v = verificarCarga(m, { folha: so(4) }, escolhas, CADASTRO, CTX, TABELA, { meses: [1] });
    expect(v.conferencia.map((c) => c.mesIdx)).toEqual([1]);
    expect(v.itens.find((x) => x.id === "periodo")).toBeUndefined();
    const p = mesParaGravar(
      "obra_teste",
      1,
      {
        ...v.payload,
        feriados: [
          { data: "2025-04-21", nome: "X" },
          { data: "2025-05-01", nome: "Y" },
        ],
      },
      false,
      "2025-04",
    );
    expect(p.feriados.map((f) => f.data)).toEqual(["2025-04-21"]);
    expect(p.refazer).toBe(false);
    expect(p.competencias.map((c) => c.mes_idx)).toEqual([1]);
    expect(p.lancamentos.every((l) => l.mes_idx === 1)).toBe(true);
  });

  it("folha com outra competência é apontada, com a ação", () => {
    const errado = montarCarga(
      { ...DADOS, inicio: { ano: 2025, mes: 4 }, meses: 1 },
      { folha: FOLHA },
      CADASTRO,
      escolhas,
      TABELA,
    );
    const v = verificarCarga(
      encaixarMes({ obra: mar.obra, movimentos: mar.movimentos }, errado, 1),
      { folha: FOLHA },
      escolhas,
      CADASTRO,
      CTX,
      TABELA,
      { meses: [1] },
    );
    expect(v.itens.find((x) => x.id === "periodo")?.detalhe).toBe(
      "mar/25: envie a folha só de abr/25.",
    );
  });
});
