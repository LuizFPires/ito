import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import escrever from "write-excel-file/node";
import type { Tabela } from "./planilha";
import { abasXlsx, FORMATOS, nomeAba, nomeArquivo } from "./planilha";

const tabela: Tabela = {
  aba: "Custo por função",
  titulo: ["Obra E2E", "Preços de 2026"],
  colunas: [
    { titulo: "Função", formato: "texto" },
    { titulo: "jan/27", formato: "moeda" },
    { titulo: "Pessoa-mês", formato: "pm" },
    { titulo: "Encargos", formato: "pct" },
  ],
  linhas: [
    ["Pedreiro", 1234.56, 5, 43.96],
    ["Total", 1234.56, 5, null],
  ],
  total: true,
};

async function abrir(tabelas: readonly Tabela[]) {
  const buf = await escrever(abasXlsx(tabelas)).toBuffer();
  const z = unzipSync(new Uint8Array(buf));
  return {
    folha: strFromU8(z["xl/worksheets/sheet1.xml"]!),
    estilos: strFromU8(z["xl/styles.xml"]!),
    livro: strFromU8(z["xl/workbook.xml"]!),
  };
}

describe("exportação .xlsx (aceite M8)", () => {
  it("números ficam números, com o formato contábil BR no estilo", async () => {
    const { folha, estilos } = await abrir([tabela]);
    // valor numérico cru (sem texto "R$ 1.234,56"), linha 5 = primeira linha de dados
    expect(folha).toMatch(/<c r="B5"[^>]*><v>1234\.56<\/v><\/c>/);
    expect(folha).not.toMatch(/<c r="B5"[^>]*t="(s|inlineStr|str)"/);
    // percentual vira fração com formato %
    expect(folha).toMatch(/<c r="D5"[^>]*><v>0\.4396<\/v><\/c>/);
    // códigos neutros: o Excel em português mostra ponto no milhar e vírgula no decimal
    const esc = (s: string) => s.replace(/"/g, "&quot;");
    expect(estilos).toContain(esc(FORMATOS.moeda));
    expect(estilos).toContain(FORMATOS.pm);
    expect(estilos).toContain(FORMATOS.pct);
  });

  it("título, cabeçalho fixo e célula vazia", () => {
    const [a] = abasXlsx([tabela]);
    expect(a!.stickyRowsCount).toBe(4);
    expect(a!.data[4]![0]).toMatchObject({ value: "Pedreiro" });
    expect(a!.data[5]![3]).toBeNull();
    expect(a!.data[5]![1]).toMatchObject({ fontWeight: "bold" });
  });

  it("nomes de aba e arquivo válidos, sem repetir aba", async () => {
    expect(nomeAba("Custo: por função / mês [R$]")).toBe("Custo  por função   mês  R$ ");
    expect(nomeArquivo(["ITO", "Obra A/B", "custos"])).toBe("ITO - Obra A B - custos.xlsx");
    const abas = abasXlsx([tabela, tabela]).map((x) => x.sheet);
    expect(abas).toEqual(["Custo por função", "Custo por função (2)"]);
    const { livro } = await abrir([tabela, tabela]);
    expect(livro).toContain('name="Custo por função (2)"');
  });
});

describe("copiar para Excel (texto tabulado BR)", () => {
  it("usa o formato de cada coluna", async () => {
    const { textoDaTabela } = await import("./planilha");
    expect(textoDaTabela(tabela)).toBe(
      "Função\tjan/27\tPessoa-mês\tEncargos\r\nPedreiro\t1.234,56\t5,0\t43,96%\r\nTotal\t1.234,56\t5,0\t",
    );
  });
});

describe("injeção de fórmula no texto colado", () => {
  it("texto que começa com = + - @ ganha apóstrofo; números não", async () => {
    const { semFormula, textoDaTabela } = await import("./planilha");
    expect(semFormula('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(semFormula("@SOMA")).toBe("'@SOMA");
    expect(semFormula("Obra -1")).toBe("Obra -1");
    expect(semFormula('"=1+1"')).toBe(`'"=1+1"`);
    expect(semFormula("  -2+3")).toBe("'  -2+3");
    expect(semFormula("\u0001=x")).toBe("'\u0001=x");
    const t = textoDaTabela({
      aba: "x",
      colunas: [
        { titulo: "Nome", formato: "texto" },
        { titulo: "Valor", formato: "moeda" },
      ],
      linhas: [["+cmd", -38.5]],
    });
    expect(t).toBe("Nome\tValor\r\n'+cmd\t-38,50");
  });
});
