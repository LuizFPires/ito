/**
 * Exportação .xlsx (M8): números de verdade nas células, com o formato contábil brasileiro.
 * Os códigos de formato do arquivo são neutros (vírgula = milhar, ponto = decimal no código); o
 * Excel em português mostra 1.234,56 sem reformatar (aceite do M8). Gerado no navegador.
 */
import { arredondar, numero, percentual } from "@ito/formato";
import type { SheetData } from "write-excel-file/browser";

export type Formato = "moeda" | "pm" | "inteiro" | "decimal" | "pct" | "texto";

/** Contábil BR: "R$" à esquerda, negativos com sinal, zero como traço. */
export const FORMATOS: Record<Exclude<Formato, "texto">, string> = {
  moeda: '_-"R$" * #,##0.00_-;-"R$" * #,##0.00_-;_-"R$" * "-"??_-;_-@_-',
  pm: "#,##0.0",
  inteiro: "#,##0",
  decimal: "#,##0.00",
  // percentual guardado de 0 a 100 (como na tela); a célula recebe a fração
  pct: "0.00%",
};

export interface Coluna {
  titulo: string;
  formato: Formato;
  largura?: number;
}

export type Valor = string | number | null | undefined;

export interface Tabela {
  /** nome da aba (até 31 caracteres, sem : \ / ? * [ ]) */
  aba: string;
  /** linhas de título acima da tabela (obra, período, preços) */
  titulo?: readonly string[];
  colunas: readonly Coluna[];
  linhas: readonly (readonly Valor[])[];
  /** última linha em negrito (total) */
  total?: boolean;
}

/** Nome de aba válido no Excel. */
export const nomeAba = (s: string) => s.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Planilha";

/** Nome de arquivo seguro, com a extensão. */
export const nomeArquivo = (partes: readonly string[]) =>
  `${partes
    .map((p) => p.replace(/[<>:"/\\|?*]+/g, " ").trim())
    .filter(Boolean)
    .join(" - ")}.xlsx`;

function celula(v: Valor, formato: Formato, negrito: boolean) {
  const fontWeight = negrito ? ("bold" as const) : undefined;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    if (formato === "texto") return { value: String(v), type: String, fontWeight };
    return {
      // arredondamento só na exportação (convenção): R$ em centavos, % com 4 casas
      value:
        formato === "pct"
          ? arredondar(v, 4) / 100
          : formato === "moeda" || formato === "decimal"
            ? arredondar(v, 2)
            : v,
      type: Number,
      format: FORMATOS[formato],
      fontWeight,
    };
  }
  return { value: v, type: String, fontWeight };
}

/** Converte as tabelas para o formato do `write-excel-file` (uma aba por tabela). */
export function abasXlsx(tabelas: readonly Tabela[]) {
  const usadas = new Set<string>();
  return tabelas.map((t) => {
    let nome = nomeAba(t.aba);
    for (let i = 2; usadas.has(nome); i++) nome = nomeAba(`${t.aba.slice(0, 27)} (${i})`);
    usadas.add(nome);
    const titulo = (t.titulo ?? []).map((x, i) => [
      { value: x, type: String, fontWeight: i === 0 ? ("bold" as const) : undefined },
    ]);
    const espaco = titulo.length ? [[null]] : [];
    const cabecalho = t.colunas.map((c) => ({
      value: c.titulo,
      type: String,
      fontWeight: "bold" as const,
      align: c.formato === "texto" ? undefined : ("right" as const),
    }));
    const corpo = t.linhas.map((l, i) =>
      t.colunas.map((c, j) => celula(l[j], c.formato, !!t.total && i === t.linhas.length - 1)),
    );
    return {
      sheet: nome,
      data: [...titulo, ...espaco, cabecalho, ...corpo] as SheetData,
      columns: t.colunas.map((c) => ({
        width: c.largura ?? (c.formato === "texto" ? Math.max(14, c.titulo.length + 4) : 14),
      })),
      stickyRowsCount: titulo.length + espaco.length + 1,
    };
  });
}

/** Baixa o .xlsx no navegador. */
export async function baixarXlsx(arquivo: string, tabelas: readonly Tabela[]): Promise<void> {
  const { default: escrever } = await import("write-excel-file/browser");
  await escrever(abasXlsx(tabelas)).toFile(arquivo);
}

/**
 * Texto colado no Excel que começa com = + - @ vira fórmula (injeção de fórmula, OWASP): um
 * apóstrofo na frente faz o Excel tratá-lo como texto. Números formatados não passam por aqui.
 */
export const semFormula = (s: string) => {
  const limpo = s.replace(/[\t\r\n]+/g, " ");
  // aspas, espaços e controles à esquerda não escondem a fórmula ("=x" ou " =x" também ganham)
  // eslint-disable-next-line no-control-regex -- controles fazem parte do ataque
  return /^[\s"'\u0000-\u001f]*[=+\-@]/.test(limpo) ? `'${limpo}` : limpo;
};

/**
 * Mesma tabela como texto tabulado para a área de transferência (colar no Excel): números no
 * formato BR (1.234,56), que o Excel em português lê como número; quebras viram espaço.
 */
export function textoDaTabela(t: Tabela): string {
  const casas: Record<Exclude<Formato, "texto">, number> = {
    moeda: 2,
    pm: 1,
    inteiro: 0,
    decimal: 2,
    pct: 2,
  };
  const cel = (v: Valor, f: Formato) =>
    v === null || v === undefined
      ? ""
      : typeof v === "number"
        ? f === "texto"
          ? String(v)
          : f === "pct"
            ? percentual(v, casas.pct)
            : numero(v, casas[f])
        : semFormula(v);
  return [
    t.colunas.map((c) => semFormula(c.titulo)).join("\t"),
    ...t.linhas.map((l) => t.colunas.map((c, j) => cel(l[j], c.formato)).join("\t")),
  ].join("\r\n");
}
