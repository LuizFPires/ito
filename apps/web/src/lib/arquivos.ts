/**
 * Arquivos da carga no navegador: .xlsx/.csv → Planilha (para @ito/carga) e o modelo .xlsx do
 * layout do ITO para baixar. O arquivo nunca sobe para o servidor (decisão M4).
 */
import type { Celula, Planilha } from "@ito/carga";
import { lerCsv, MODELOS } from "@ito/carga";
import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

/** CSV salvo pelo Excel no Brasil costuma vir em Windows-1252: tenta UTF-8 e cai para ele. */
export function decodificarTexto(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export const ehCsv = (f: File) => /\.(csv|txt)$/i.test(f.name) || f.type === "text/csv";

export async function planilhaDe(f: File): Promise<Planilha> {
  if (ehCsv(f)) return { [f.name]: lerCsv(decodificarTexto(await f.arrayBuffer())) };
  const abas = await readXlsxFile(f);
  return Object.fromEntries(abas.map((a) => [a.sheet, a.data as unknown as Celula[][]]));
}

/** Modelo .xlsx: uma aba por parte do arquivo (só cabeçalhos) + aba Instruções. */
export async function baixarModelo(tipo: keyof typeof MODELOS): Promise<void> {
  const m = MODELOS[tipo];
  const abas = m.abas.map((aba) => ({
    sheet: aba.nome,
    data: [aba.colunas.map((c) => ({ value: c.titulo, fontWeight: "bold" as const }))],
    columns: aba.colunas.map((c) => ({ width: Math.max(14, c.titulo.length + 4) })),
    stickyRowsCount: 1,
  }));
  const instrucoes = [
    ["Aba", "Coluna", "Obrigatória", "O que informar", "Exemplo"].map((v) => ({
      value: v,
      fontWeight: "bold" as const,
    })),
    ...m.abas.flatMap((aba) =>
      aba.colunas.map((c) =>
        [aba.nome, c.titulo, c.obrigatoria ? "Sim" : "Não", c.ajuda, String(c.exemplo)].map(
          (v) => ({ value: v }),
        ),
      ),
    ),
    [{ value: "" }],
    [
      {
        value:
          "Uma linha por competência e matrícula (na aba Rubricas, por rubrica). Não informe nome, CPF nem endereço: o ITO só guarda a matrícula.",
      },
    ],
  ];
  await writeXlsxFile([
    ...abas,
    {
      sheet: "Instruções",
      data: instrucoes,
      columns: [{ width: 12 }, { width: 22 }, { width: 12 }, { width: 70 }, { width: 16 }],
    },
  ]).toFile(m.arquivo);
}
