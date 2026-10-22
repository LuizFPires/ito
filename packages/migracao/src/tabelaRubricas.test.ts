import { describe, expect, it } from "vitest";
import { classificarRubrica } from "./rubricas";
import { montarTabelaRubricas, PRIMEIRO_CODIGO_MIGRACAO } from "./tabelaRubricas";

const dic = [
  { codigo: 1, nome: "HORAS NORMAIS" },
  { codigo: 29, nome: "FÉRIAS PROPORCIONAIS" },
  { codigo: 170, nome: "ADICIONAL DE TRANSFERÊNCIA 25%" },
  { codigo: 2126, nome: "PRÊMIO" },
];
const o = (codigoPlanilha: number | null, titulo: string, sinal: "+" | "-" | "" = "+") => ({
  codigoPlanilha,
  titulo,
  sinal,
});

describe("tabela de rubricas da migração", () => {
  const { linhas, resolver } = montarTabelaRubricas(
    [
      o(1, "HORAS NORMAIS"),
      o(29, "FERIAS PROPORCIONAIS "),
      o(29, "ADICIONAL DE TRANSFERENCIA 25%"), // coluna renomeada, código velho
      o(2126, "LICENÇA REMUNERADA"), // idem, sem rubrica no ITO
      o(8550, "13 SALARIO INTEGRAL RESCISAO"),
      o(8550, "13 SALARIO INTEGRAL RESCISAO"),
      o(8550, "1/3 SOBRE ABONO DE FERIAS"),
      o(null, "AJUDA DE CUSTO"),
      o(null, "EMPRÉSTIMO (CRÉDITO TRABALHADOR)", "-"),
      o(825, "INSS 13o SALARIO", "-"),
    ],
    dic,
  );
  const cod = (c: number | null, t: string) => resolver(c, t);

  it("código e título que batem com o dicionário", () => {
    expect(cod(1, "HORAS NORMAIS")).toBe(1);
    expect(cod(29, "Férias proporcionais")).toBe(29);
  });

  it("coluna renomeada vai para a rubrica do título", () => {
    expect(cod(29, "ADICIONAL DE TRANSFERENCIA 25%")).toBe(170);
  });

  it("código novo: o título mais frequente fica com ele; os outros ganham código da migração", () => {
    expect(cod(8550, "13 SALARIO INTEGRAL RESCISAO")).toBe(8550);
    const abono = cod(8550, "1/3 SOBRE ABONO DE FERIAS")!;
    const licenca = cod(2126, "LICENÇA REMUNERADA")!;
    expect(abono).toBeGreaterThanOrEqual(PRIMEIRO_CODIGO_MIGRACAO);
    expect(licenca).toBeGreaterThanOrEqual(PRIMEIRO_CODIGO_MIGRACAO);
    expect(abono).not.toBe(licenca);
  });

  it("sem código: colunas conhecidas e o resto por título", () => {
    expect(cod(null, "AJUDA DE CUSTO")).toBe(9003);
    expect(cod(null, "EMPRÉSTIMO (CRÉDITO TRABALHADOR)")).toBeGreaterThanOrEqual(
      PRIMEIRO_CODIGO_MIGRACAO,
    );
    expect(cod(null, "")).toBeNull();
  });

  it("classificação sugerida só para o que o ITO não tem", () => {
    const l = (t: string) => linhas.find((x) => x.titulo === t)!;
    expect(l("HORAS NORMAIS").nova).toBeNull();
    expect(l("13 SALARIO INTEGRAL RESCISAO").nova).toMatchObject({
      tipo: "provento",
      componente: "resc",
    });
    expect(l("INSS 13o SALARIO").nova).toMatchObject({ tipo: "desconto", componente: "nao" });
    expect(l("EMPRÉSTIMO (CRÉDITO TRABALHADOR)").nova).toMatchObject({ tipo: "desconto" });
  });

  it("revisão gravada manda sobre as regras", () => {
    const r = montarTabelaRubricas([o(29, "ADICIONAL DE TRANSFERENCIA 25%")], dic, [
      { codigoPlanilha: 29, titulo: "adicional de transferência 25%", codigo: 2126 },
    ]);
    expect(r.resolver(29, "ADICIONAL DE TRANSFERENCIA 25%")).toBe(2126);
  });
});

describe("classificação de rubrica nova", () => {
  it("provisões pagas, rescisão, descontos e informativos", () => {
    expect(classificarRubrica("ADIANTAMENTO 13 SALARIO", "+")).toMatchObject({
      componente: "provpaga",
    });
    expect(classificarRubrica("AVISO PRÉVIO", "+")).toMatchObject({ componente: "resc" });
    expect(classificarRubrica("HORAS FALTAS PARCIAL", "-")).toMatchObject({ componente: "faltas" });
    expect(classificarRubrica("VALE TRANSPORTE VALOR", "")).toMatchObject({ tipo: "informativo" });
    expect(classificarRubrica("BONIFICAÇÃO ASSIDUIDADE", "+")).toMatchObject({
      componente: "extras",
      baseProvisoes: true,
    });
  });
});
