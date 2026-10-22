import { describe, expect, it } from "vitest";
import type { Abas } from "./historico";
import { lerModeloXlsb, sinalPeloNome } from "./modeloXlsb";
import { histogramaDaPlanilha, lerModeloXlsm } from "./modeloXlsm";

// .xlsm sintético (só matrícula; a coluna do nome existe mas nunca é lida)
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const folhaXlsm = (): Abas => {
  const cab1 = [
    null,
    "Cód. Func.",
    "Nome do Funcionário",
    "Função",
    "Classe",
    "MDO Realocada?",
    "Data de Admissão",
    "Data de Demissão",
    "Dias de Licença",
    "Dias de Férias",
    "Competência da Folha",
    "Salário",
    null,
    null,
    'Horas Extras "A" 100%',
    null,
    "Faltas",
    null,
    null,
  ];
  const cab2 = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "Contratual R$",
    "Referência (dias)",
    "Salário Base R$",
    "Qtde de Horas",
    "Valor R$",
    "Faltas (dias)",
    "Faltas (horas)",
    "Desconto Faltas R$",
  ];
  const linha = (
    mat: string,
    funcao: string,
    comp: string,
    dias: number | null,
    sal: number,
    he = 0,
    adm: string | null = null,
  ) => [
    1,
    mat,
    "NÃO LER",
    funcao,
    "PEDREIRO",
    null,
    adm ? d(adm) : null,
    null,
    0,
    0,
    d(comp),
    2000,
    dias,
    sal,
    he ? 10 : 0,
    he,
    0,
    4,
    40,
  ];
  return {
    Folha: [
      [null, "FOLHA DE PAGAMENTO"],
      [],
      [],
      [],
      cab1,
      cab2,
      [],
      linha("1001", "PEDREIRO A", "2017-02-28", 20, 1500, 0, "2017-02-09"),
      linha("1001", "PEDREIRO A", "2017-03-31", 31, 2000, 181.82),
      linha("1002", "N/A", "2017-03-31", null, 0), // linha vazia da planilha
      linha("1003", "SERVENTE", "2017-03-31", null, 150), // recebeu sem trabalhar no mês
    ],
    Premissas: [
      [null, "PREMISSAS"],
      [null, "OBRA MART MINAS TESTE"],
      [],
      [null, "Início", null, d("2017-02-01")],
    ],
    Resultados: [
      [],
      [null, "CLASSE / REF", "TOTAL", d("2017-02-01"), d("2017-03-01")],
      [null, "TOTAL HISTOGRAMA", 1.71, 0.71, 1],
    ],
  };
};

describe("modelo .xlsm (colunas pelo nome)", () => {
  const p = lerModeloXlsm(folhaXlsm(), "TESTE/teste.xlsm", "classica");

  it("lê matrícula, função, dias, admissão e rubricas, sem o nome", () => {
    expect(p.titulo).toBe("OBRA MART MINAS TESTE");
    expect(p.inicio).toEqual({ ano: 2017, mes: 2 });
    expect(p.linhas).toHaveLength(3);
    const [fev, mar] = p.linhas;
    expect(fev).toMatchObject({
      matricula: "1001",
      funcao: "PEDREIRO A",
      classe: "PEDREIRO",
      dias: 20,
      admitido: true,
    });
    expect(mar!.rubricas).toEqual([
      { codigo: 1, descricao: "HORAS NORMAIS", referencia: 31, valor: 2000 },
      { codigo: 200, descricao: "HORAS EXTRAS 100%", referencia: 10, valor: 181.82 },
      { codigo: 40, descricao: "HORAS FALTAS", referencia: 4, valor: 40 },
    ]);
    expect(JSON.stringify(p)).not.toContain("NÃO LER");
  });

  it("linha sem função e sem salário fica de fora; dias vazios = não trabalhou", () => {
    expect(p.avisos.map((a) => a.texto)).toContain("1 linhas sem função e sem salário (vazias)");
    expect(p.linhas.find((l) => l.matricula === "1003")!.dias).toBe(0);
  });

  it("histograma da aba Resultados", () => {
    expect(histogramaDaPlanilha(folhaXlsm().Resultados!)).toEqual([
      { comp: { ano: 2017, mes: 2 }, pm: 0.71 },
      { comp: { ano: 2017, mes: 3 }, pm: 1 },
    ]);
  });
});

describe("modelo .xlsb (uma coluna por rubrica)", () => {
  // linha 2: sinais; linha 5: códigos; linha 6: títulos; dados da linha 7 (índice 6)
  const sinais: unknown[] = [];
  const codigos: unknown[] = [];
  const titulos: unknown[] = [
    null,
    "Cód Func",
    "Nome Funcionário",
    "PC",
    "Função",
    "Status",
    "Competência",
  ];
  titulos[12] = "Salário Base";
  const col = (c: number, sinal: string, codigo: number | null, titulo: string) => {
    sinais[c] = sinal;
    codigos[c] = codigo;
    titulos[c] = titulo;
  };
  col(13, "+", 1, "HORAS NORMAIS");
  col(14, "+", 200, "HORAS EXTRAS 100%");
  col(15, "-", 998, "I.N.S.S.");
  col(16, "", 51, "LIQUIDO RESCISAO");
  col(17, "", null, "ARREDONDAMENTO (+)");
  col(18, "", 8792, "DIAS FALTAS");
  titulos[19] = "Proventos";
  const linha = (mat: number, serial: number, normais: number, he: number, resc = 0) => {
    const l: unknown[] = [null, mat, "NÃO LER", "04.03.15", "Pedreiro", "Trabalhando", serial];
    l[12] = 2200;
    l[13] = normais;
    l[14] = he;
    l[15] = 180;
    l[16] = resc;
    l[17] = 0.5;
    l[18] = 2;
    l[19] = normais + he + resc + 0.5;
    return l;
  };
  const abas = {
    Premissas: [[], [], [null, null, null, "OBRA TESTE XLSB"]],
    Histograma: [
      [],
      sinais,
      [],
      [],
      codigos,
      titulos,
      linha(99001, 45108, 1100, 200),
      linha(99001, 45139, 2200, 0, 3000),
    ],
  } as unknown as Abas;
  const ito = new Set([1, 200, 998]);
  const p = lerModeloXlsb(abas, "TESTE/teste.xlsb", "ampla", ito);

  it("rubricas pelo código, fração do mês, admissão e rescisão estimadas", () => {
    expect(p.titulo).toBe("OBRA TESTE XLSB");
    const [jul, ago] = p.linhas;
    expect(jul).toMatchObject({
      matricula: "99001",
      construtora: "ampla",
      funcao: "PEDREIRO",
      admitido: true,
      desligado: false,
    });
    // metade do salário em horas normais = meio mês (31 dias → 16)
    expect(jul!.dias).toBe(16);
    // HE estimada: 200 ÷ (2.200 ÷ 220 × 2) = 10 h
    expect(jul!.rubricas.find((r) => r.codigo === 200)!.referencia).toBe(10);
    expect(ago).toMatchObject({ dias: null, admitido: false, desligado: true });
    expect(JSON.stringify(p)).not.toContain("NÃO LER");
  });

  it("rubricas que o ITO não tem e proventos conferidos com a planilha", () => {
    expect(p.rubricasNovas.map((r) => r.codigo)).toEqual([51, 990, 8792]);
    expect(p.avisos.filter((a) => a.tipo === "conferencia")).toEqual([]);
  });

  it("sinal de coluna sem sinal, pelo nome", () => {
    expect(sinalPeloNome("ARREDONDAMENTO (-)")).toBe("-");
    expect(sinalPeloNome("ARREDONDAMENTO (+)")).toBe("+");
    expect(sinalPeloNome("DIAS FALTAS")).toBe("");
    expect(sinalPeloNome("VALE TRANSPORTE VALOR")).toBe("");
    expect(sinalPeloNome("EMPRÉSTIMO (CRÉDITO TRABALHADOR)")).toBe("-");
    expect(sinalPeloNome("13 SALARIO INTEGRAL")).toBe("+");
  });
});
