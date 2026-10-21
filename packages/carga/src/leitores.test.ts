import { describe, expect, it } from "vitest";
import { lerErp, lerFolha, lerNotasFiscais, lerPonto, lerVt } from "./leitores";
import { lerCompetencia, lerCsv, lerNumero } from "./planilha";

const CAB_RUB = [
  "Competência",
  "Matrícula",
  "Nome",
  "Função",
  "Rubrica",
  "Descrição",
  "Referência",
  "Valor",
];

describe("células", () => {
  it("competência em vários formatos", () => {
    const mar25 = { ano: 2025, mes: 3 };
    for (const c of ["03/2025", "3/2025", "2025-03", "mar/25", "Março/2025", "01/03/2025", 202503])
      expect(lerCompetencia(c)).toEqual(mar25);
    expect(lerCompetencia(new Date(Date.UTC(2025, 2, 1)))).toEqual(mar25);
    expect(lerCompetencia("13/2025")).toBeNull();
    expect(lerCompetencia("")).toBeNull();
  });
  it("número brasileiro, número do Excel e ponto decimal", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero(1234.56)).toBe(1234.56);
    expect(lerNumero("1234.56")).toBe(1234.56);
    expect(lerNumero("abc")).toBeNull();
  });
  it("CSV com ponto e vírgula e aspas", () => {
    expect(lerCsv('a;b\r\n"1;2";"x ""y"""\n')).toEqual([
      ["a", "b"],
      ["1;2", 'x "y"'],
    ]);
    expect(lerCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("folha no layout ITO", () => {
  const planilha = {
    Rubricas: [
      ["FOLHA ANALÍTICA — OBRA X"], // título acima do cabeçalho
      CAB_RUB,
      ["03/2025", 1001, "FULANO DE TAL", "pedreiro ", 1, "HORAS NORMAIS", 220, "1.650,00"],
      ["03/2025", 1001, "FULANO DE TAL", "PEDREIRO", 200, "HE 100%", 10, 150],
      ["03/2025", 1001, "FULANO DE TAL", "PEDREIRO", 200, "HE 100%", 2, 30], // complementar: soma
      ["03/2025", "1002", "BELTRANO", "SERVENTE", 1, "HORAS NORMAIS", 110, "550"],
      [],
    ],
    Pessoas: [
      [
        "Competência",
        "Matrícula",
        "Função",
        "Dias de vínculo",
        "Admitido",
        "Desligado",
        "Faltas (h)",
      ],
      ["03/2025", 1001, "PEDREIRO", "", "S", "", 8],
      ["03/2025", 1002, "SERVENTE", 15, "", "x", ""],
    ],
    Resumo: [
      ["Competência", "Total de proventos"],
      ["03/2025", "2.380,00"],
    ],
  };
  const r = lerFolha(planilha);

  it("lê rubricas, soma lançamentos complementares e normaliza a função", () => {
    expect(r.erros).toEqual([]);
    expect(r.rubricas).toHaveLength(3);
    const he = r.rubricas.find((x) => x.codigo === 200)!;
    expect(he).toMatchObject({ matricula: "1001", funcao: "PEDREIRO", referencia: 12, valor: 180 });
  });

  it("nunca leva o nome adiante (regra 2)", () => {
    expect(JSON.stringify(r)).not.toMatch(/FULANO|BELTRANO/);
  });

  it("pessoas: dias vazios = mês cheio; S/x = sim", () => {
    expect(r.pessoas[0]).toMatchObject({
      dias: null,
      admitido: true,
      desligado: false,
      faltasHoras: 8,
    });
    expect(r.pessoas[1]).toMatchObject({ dias: 15, admitido: false, desligado: true });
    expect(r.resumo).toEqual([{ comp: { ano: 2025, mes: 3 }, proventos: 2380 }]);
  });

  it("erros dizem aba, linha e o que fazer", () => {
    const e = lerFolha({
      Rubricas: [
        CAB_RUB,
        ["13/2025", 1, "", "PEDREIRO", 1, "", 0, 10],
        ["03/2025", 1, "", "PEDREIRO", "x", "", 0, 10],
      ],
    });
    expect(e.erros).toEqual([
      { aba: "Rubricas", linha: 2, mensagem: "Competência inválida: use mm/aaaa (03/2025)." },
      { aba: "Rubricas", linha: 3, mensagem: "Rubrica inválida: informe o código numérico." },
    ]);
    expect(lerFolha({ Outra: [["x"]], Mais: [["y"]] }).erros[0]!.mensagem).toBe(
      "Falta a aba Rubricas. Use o modelo do ITO.",
    );
    expect(lerFolha({ Rubricas: [["Competência", "Valor"]] }).erros[0]!.mensagem).toContain(
      "precisa das colunas Competência, Matrícula, Função, Rubrica, Valor",
    );
  });

  it("um .csv (aba única) é lido como a aba Rubricas", () => {
    const csv = lerFolha({
      "folha.csv": lerCsv(`${CAB_RUB.join(";")}\n03/2025;7;X;SERVENTE;1;;220;"1.100,00"`),
    });
    expect(csv.erros).toEqual([]);
    expect(csv.rubricas[0]).toMatchObject({ matricula: "7", valor: 1100 });
  });
});

describe("ponto, VT e ERP", () => {
  it("ponto", () => {
    const r = lerPonto({
      p: [
        ["Competência", "Matrícula", "HE", "Faltas"],
        ["03/2025", 1001, "12,5", 8],
      ],
    });
    expect(r).toEqual({
      linhas: [{ comp: { ano: 2025, mes: 3 }, matricula: "1001", he: 12.5, faltas: 8 }],
      erros: [],
    });
  });
  it("VT", () => {
    const r = lerVt({
      VT: [
        ["Competência", "Matrícula", "Crédito"],
        ["mar/25", 1001, "242,00"],
      ],
    });
    expect(r.linhas).toEqual([{ comp: { ano: 2025, mes: 3 }, matricula: "1001", valor: 242 }]);
  });
  it("ERP soma a mesma conta no mês", () => {
    const r = lerErp({
      Realizado: [
        ["Competência", "Conta", "Valor"],
        ["03/2025", "04.03.01", "100,00"],
        ["03/2025", "04.03.01", 50],
      ],
    });
    expect(r.linhas).toEqual([{ comp: { ano: 2025, mes: 3 }, conta: "04.03.01", valor: 150 }]);
  });
});

describe("NF de prestador (XML)", () => {
  const nacional = `<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="x">
    <nNFSe>412</nNFSe><emit><CNPJ>12345678000199</CNPJ></emit><valores><vISSQN>30.00</vISSQN></valores>
    <DPS><infDPS><dCompet>2025-03-15</dCompet><prest><CNPJ>12345678000199</CNPJ></prest>
    <valores><vServPrest><vServ>1000.00</vServ></vServPrest><trib><tribFed><piscofins><vPis>6.50</vPis>
    <vCofins>30.00</vCofins></piscofins><vRetCP>110.00</vRetCP></tribFed></trib></valores></infDPS></DPS>
    </infNFSe></NFSe>`;
  const abrasf = `<ListaNfse><CompNfse><Nfse><InfNfse><Numero>77</Numero>
    <PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>11.222.333/0001-81</Cnpj></CpfCnpj></IdentificacaoPrestador></PrestadorServico>
    <Servico><Valores><ValorServicos>500,00</ValorServicos><ValorIss>25</ValorIss></Valores></Servico>
    </InfNfse></Nfse></CompNfse><CompNfse><Nfse><InfNfse><Numero>78</Numero>
    <PrestadorServico><CpfCnpj><Cpf>12345678901</Cpf></CpfCnpj></PrestadorServico></InfNfse></Nfse></CompNfse></ListaNfse>`;

  it("padrão nacional", () => {
    const r = lerNotasFiscais(nacional, "nf412.xml");
    expect(r.erros).toEqual([]);
    expect(r.notas[0]).toMatchObject({
      numero: "412",
      prestadorCnpj: "12345678000199",
      comp: { ano: 2025, mes: 3 },
      valor: 1000,
      iss: 30,
      pis: 6.5,
      cofins: 30,
      inss: 110,
    });
  });

  it("ABRASF em lote: sem competência fica null; CPF não é guardado", () => {
    const r = lerNotasFiscais(abrasf, "lote.xml");
    expect(r.notas).toHaveLength(1);
    expect(r.notas[0]).toMatchObject({
      numero: "77",
      prestadorCnpj: "11222333000181",
      comp: null,
      valor: 500,
      iss: 25,
    });
    expect(r.erros[0]!.mensagem).toContain("NF 78: prestador sem CNPJ");
    expect(JSON.stringify(r)).not.toContain("12345678901");
  });

  it("XML quebrado", () => {
    expect(lerNotasFiscais("<a><b></a>", "x.xml").erros[0]!.mensagem).toContain("XML inválido");
  });
});
