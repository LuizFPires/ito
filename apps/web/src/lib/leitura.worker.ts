/// <reference lib="webworker" />
// Web Worker da leitura da carga (M14 · S07): lê fora da tela; a tela pode cancelar
// (terminate) ou desistir pelo tempo-limite. O arquivo continua só no navegador (decisão M4).
import readXlsxFile from "read-excel-file/web-worker";
import type { TipoArquivo } from "@ito/carga";
import { ErroArquivo, lerArquivos } from "./leitura";

interface Pedido {
  tipo: TipoArquivo;
  arquivos: File[];
}

self.onmessage = async (ev: MessageEvent<Pedido>) => {
  try {
    const arquivos = await Promise.all(
      ev.data.arquivos.map(async (f) => ({
        name: f.name,
        type: f.type,
        bytes: await f.arrayBuffer(),
      })),
    );
    const r = await lerArquivos(ev.data.tipo, arquivos, (b) => readXlsxFile(b));
    self.postMessage({ ok: true, r });
  } catch (e) {
    self.postMessage({ ok: false, mensagem: e instanceof ErroArquivo ? e.message : null });
  }
};
