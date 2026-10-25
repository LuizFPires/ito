/**
 * Monitoramento próprio (M14): tempos de tela e erros vão para o banco (`registrar_metricas`), sem
 * dado pessoal — sem usuário, rota sem ids, erro só com a mensagem e o arquivo. Em lotes, a cada
 * 30 s e ao sair da aba; falha de envio não incomoda ninguém (fica sem a métrica).
 */
import { supabase } from "./supabase";

export interface Metrica {
  tipo: "vital" | "tempo" | "erro";
  nome: string;
  valor?: number | null;
  detalhe?: string;
}
type Linha = Metrica & { rota: string; versao: string };

const VERSAO = typeof __VERSAO_SITE__ === "string" ? __VERSAO_SITE__ : "local";
const PALAVRAS = new Set(["nova", "editar", "lancar", "imprimir", "comparar", "novo"]);

/** "/obras/mm_paracatu/lancar" → "/obras/:id/lancar": a rota sem o que identifica a obra. */
export function rotaAnonima(caminho: string): string {
  return caminho
    .split("/")
    .map((s, i) => (i < 2 || !s || PALAVRAS.has(s) ? s : ":id"))
    .join("/")
    .slice(0, 120);
}

/** Só a mensagem e onde (arquivo:linha), sem pilha completa nem dados. */
export function detalheDoErro(e: unknown): string {
  const err = e as { message?: unknown; stack?: unknown } | null;
  const msg = String(err?.message ?? e ?? "erro").replace(/\s+/g, " ");
  const onde = /([\w.-]+\.(?:js|ts|tsx)):(\d+)/.exec(String(err?.stack ?? ""));
  return `${msg.slice(0, 220)}${onde ? ` @ ${onde[1]}:${onde[2]}` : ""}`.slice(0, 300);
}

const fila: Linha[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

function enviar() {
  if (relogio) clearTimeout(relogio);
  relogio = null;
  const lote = fila.splice(0, 50);
  if (!lote.length) return;
  void supabase.rpc("registrar_metricas", { p: lote as never }).then(
    () => undefined,
    () => undefined,
  );
}

export function registrar(m: Metrica) {
  if (fila.length >= 200) return; // sem rede por muito tempo: não acumula sem fim
  fila.push({
    ...m,
    valor: m.valor == null ? null : Math.round(m.valor * 1000) / 1000,
    rota: rotaAnonima(location.pathname),
    versao: VERSAO,
  });
  if (fila.length >= 50) enviar();
  else relogio ??= setTimeout(enviar, 30_000);
}

/** Tempo de uma operação da tela (abrir o histograma, o resultado…), em ms. */
export function medirTempo(nome: string, ms: number) {
  if (Number.isFinite(ms) && ms >= 0) registrar({ tipo: "tempo", nome, valor: ms });
  try {
    performance.measure(`ito:${nome}`, { start: performance.now() - ms, duration: ms });
  } catch {
    // navegador sem User Timing nível 3: fica só o registro
  }
}

let iniciado = false;

/** Web Vitals (LCP, CLS, INP, TTFB) e erros da página; uma vez por carregamento. */
export function iniciarMonitoramento() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const observar = (tipo: string, cb: (e: PerformanceEntry[]) => void, extra = {}) => {
    try {
      new PerformanceObserver((l) => cb(l.getEntries())).observe({
        type: tipo,
        buffered: true,
        ...extra,
      });
    } catch {
      // tipo não suportado neste navegador
    }
  };
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  observar("largest-contentful-paint", (es) => (lcp = es.at(-1)?.startTime ?? lcp));
  observar("layout-shift", (es) => {
    for (const e of es as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
      if (!e.hadRecentInput) cls += e.value;
  });
  observar(
    "event",
    (es) => {
      for (const e of es) inp = Math.max(inp, e.duration);
    },
    { durationThreshold: 40 },
  );
  const nav = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (nav) registrar({ tipo: "vital", nome: "TTFB", valor: nav.responseStart });

  let fechado = false;
  addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (!fechado) {
      fechado = true;
      if (lcp) registrar({ tipo: "vital", nome: "LCP", valor: lcp });
      registrar({ tipo: "vital", nome: "CLS", valor: cls * 1000 }); // milésimos
      if (inp) registrar({ tipo: "vital", nome: "INP", valor: inp });
    }
    enviar();
  });
  addEventListener("error", (ev) =>
    registrar({ tipo: "erro", nome: "erro", detalhe: detalheDoErro(ev.error ?? ev.message) }),
  );
  addEventListener("unhandledrejection", (ev) =>
    registrar({ tipo: "erro", nome: "promessa", detalhe: detalheDoErro(ev.reason) }),
  );
}
