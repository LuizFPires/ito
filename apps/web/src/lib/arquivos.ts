/**
 * Modelo .xlsx do layout do ITO para baixar (a leitura dos arquivos fica em leitura.ts, num
 * Web Worker). O arquivo nunca sobe para o servidor (decisão M4).
 */
import { MODELOS } from "@ito/carga";
import writeXlsxFile from "write-excel-file/browser";

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
