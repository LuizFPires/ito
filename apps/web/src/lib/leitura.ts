/**
 * Leitura dos arquivos da carga (M14 · S07): planilha ou XML → dados com matrícula, erros e o
 * resumo da tela. Roda no Web Worker (`leitura.worker.ts`), longe da tela: arquivo grande não
 * trava o navegador e pode ser cancelado. Sem DOM aqui; o leitor de .xlsx vem de quem chama.
 */
import type { Celula, ErroLeitura, Leituras, Planilha, TipoArquivo } from "@ito/carga";
import { lerCsv, lerErp, lerFolha, lerNotasFiscais, lerPonto, lerVt } from "@ito/carga";
import { moeda, numero } from "@ito/formato";
import { LIMITES_ARQUIVO } from "./limitesArquivos";

/** CSV salvo pelo Excel no Brasil costuma vir em Windows-1252: tenta UTF-8 e cai para ele. */
export function decodificarTexto(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export const ehCsv = (f: { name: string; type?: string }) =>
  /\.(csv|txt)$/i.test(f.name) || f.type === "text/csv";

export interface Arquivo {
  name: string;
  type?: string;
  bytes: ArrayBuffer;
}
/** Abas do .xlsx: [nome, linhas] (read-excel-file na tela ou no worker). */
export type LerXlsx = (bytes: ArrayBuffer) => Promise<{ sheet: string; data: unknown[][] }[]>;

export interface ResultadoLeitura {
  parcial: Partial<Leituras>;
  resumo: string;
  erros: ErroLeitura[];
}

/** Erro de leitura com o texto para quem carrega (limite, arquivo fora do layout). */
export class ErroArquivo extends Error {}

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

async function planilha(a: Arquivo, lerXlsx: LerXlsx): Promise<Planilha> {
  if (ehCsv(a)) return { [a.name]: lerCsv(decodificarTexto(a.bytes)) };
  const abas = await lerXlsx(a.bytes);
  if (abas.length > LIMITES_ARQUIVO.abas)
    throw new ErroArquivo(
      `Planilha com mais de ${LIMITES_ARQUIVO.abas} abas: use o modelo do ITO.`,
    );
  const grande = abas.find((x) => x.data.length > LIMITES_ARQUIVO.linhas);
  if (grande)
    throw new ErroArquivo(
      `A aba “${grande.sheet}” passa de ${numero(LIMITES_ARQUIVO.linhas)} linhas: divida o arquivo por período.`,
    );
  return Object.fromEntries(abas.map((x) => [x.sheet, x.data as unknown as Celula[][]]));
}

export async function lerArquivos(
  tipo: TipoArquivo,
  arquivos: readonly Arquivo[],
  lerXlsx: LerXlsx,
): Promise<ResultadoLeitura> {
  if (tipo === "nf") {
    const lidas = arquivos.map((a) => lerNotasFiscais(decodificarTexto(a.bytes), a.name));
    const notas = lidas.flatMap((l) => l.notas);
    const soma = (k: "valor" | "iss" | "pis" | "cofins") =>
      moeda(notas.reduce((t, n) => t + n[k], 0));
    return {
      parcial: { notas },
      erros: lidas.flatMap((l) => l.erros),
      resumo: `${plural(notas.length, "nota", "notas")} · ${soma("valor")} em serviços · ISS ${soma("iss")}, PIS ${soma("pis")} e COFINS ${soma("cofins")} retidos`,
    };
  }
  const p = await planilha(arquivos[0]!, lerXlsx);
  if (tipo === "folha") {
    const folha = lerFolha(p);
    const comps = new Set(folha.rubricas.map((x) => `${x.comp.ano}-${x.comp.mes}`)).size;
    const mats = new Set(folha.rubricas.map((x) => x.matricula)).size;
    const rubs = new Set(folha.rubricas.map((x) => x.codigo)).size;
    return {
      parcial: { folha },
      erros: folha.erros,
      resumo: `${plural(comps, "competência", "competências")} · ${plural(folha.rubricas.length, "lançamento", "lançamentos")} · ${plural(mats, "matrícula", "matrículas")} · ${plural(rubs, "rubrica", "rubricas")}`,
    };
  }
  if (tipo === "ponto") {
    const l = lerPonto(p);
    return {
      parcial: { ponto: l.linhas },
      erros: l.erros,
      resumo: `${numero(
        l.linhas.reduce((t, x) => t + x.he, 0),
        1,
      )} h de HE · ${numero(
        l.linhas.reduce((t, x) => t + x.faltas, 0),
        1,
      )} h de falta`,
    };
  }
  if (tipo === "vt") {
    const l = lerVt(p);
    return {
      parcial: { vt: l.linhas },
      erros: l.erros,
      resumo: `${plural(l.linhas.length, "crédito", "créditos")} · ${moeda(l.linhas.reduce((t, x) => t + x.valor, 0))}`,
    };
  }
  const l = lerErp(p);
  const meses = new Set(l.linhas.map((x) => `${x.comp.ano}-${x.comp.mes}`)).size;
  const contas = [...new Set(l.linhas.map((x) => x.conta))].sort();
  return {
    parcial: { erp: l.linhas },
    erros: l.erros,
    resumo: `${plural(meses, "mês", "meses")} · ${
      contas.length > 1
        ? `contas ${contas[0]} a ${contas[contas.length - 1]}`
        : plural(contas.length, "conta", "contas")
    }`,
  };
}
