/**
 * Lê os arquivos da carga num Web Worker (M14 · S07), com tempo-limite e cancelamento: o worker é
 * encerrado na hora, sem esperar a leitura terminar.
 */
import type { TipoArquivo } from "@ito/carga";
import type { ResultadoLeitura } from "./leitura";

export const TEMPO_LIMITE_LEITURA = 120_000;

export class LeituraInterrompida extends Error {
  constructor(
    public motivo: "cancelada" | "tempo" | "arquivo" | "falha",
    mensagem = "",
  ) {
    super(mensagem);
  }
}

export function lerNoWorker(
  tipo: TipoArquivo,
  arquivos: readonly File[],
  sinal: AbortSignal,
  limiteMs = TEMPO_LIMITE_LEITURA,
): Promise<ResultadoLeitura> {
  return new Promise((ok, falha) => {
    const w = new Worker(new URL("./leitura.worker.ts", import.meta.url), { type: "module" });
    const fim = (f: () => void) => {
      clearTimeout(relogio);
      sinal.removeEventListener("abort", cancelar);
      w.terminate();
      f();
    };
    const cancelar = () => fim(() => falha(new LeituraInterrompida("cancelada")));
    const relogio = setTimeout(() => fim(() => falha(new LeituraInterrompida("tempo"))), limiteMs);
    sinal.addEventListener("abort", cancelar);
    w.onmessage = (ev: MessageEvent<{ ok: boolean; r?: ResultadoLeitura; mensagem?: string }>) =>
      fim(() =>
        ev.data.ok
          ? ok(ev.data.r!)
          : falha(
              ev.data.mensagem
                ? new LeituraInterrompida("arquivo", ev.data.mensagem)
                : new LeituraInterrompida("falha"),
            ),
      );
    w.onerror = () => fim(() => falha(new LeituraInterrompida("falha")));
    w.postMessage({ tipo, arquivos: [...arquivos] });
  });
}
