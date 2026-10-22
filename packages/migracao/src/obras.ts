/**
 * Planilhas → obras (M9): as planilhas Ampla e Clássica da mesma obra viram uma obra só (cada
 * lançamento guarda a construtora); entre versões da mesma obra e construtora vale a que tem os
 * dados mais recentes (empate: o arquivo mais novo). Dados da obra que a planilha não traz vão
 * para `docs/migracao/obras.csv`, que o usuário completa (área, cidade, tipologia).
 */
import type { Competencia, Construtora } from "@ito/carga";
import type { PlanilhaHistorica } from "./historico";
import { normal } from "./historico";

export interface ArquivoLido {
  /** caminho relativo à pasta das planilhas */
  caminho: string;
  /** milissegundos (data de modificação do arquivo) */
  modificado: number;
  planilha: PlanilhaHistorica;
}

export interface ObraHistorica {
  id: string;
  /** nome da pasta, sem o sufixo da construtora */
  pasta: string;
  planilhas: ArquivoLido[];
  descartadas: { caminho: string; motivo: string }[];
}

export const construtoraDe = (caminho: string): Construtora =>
  /ampla/i.test(caminho) ? "ampla" : "classica";

const SUFIXO = /\s*-\s*(ampla|classica|clássica)\s*$/i;

/** Código da obra no ITO: minúsculas, sem acento, separado por "_". */
export const idDaObra = (pasta: string) =>
  normal(pasta.replace(SUFIXO, ""))
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "o_$1")
    .slice(0, 48) || "obra";

const ultimoMes = (p: PlanilhaHistorica) =>
  p.linhas.reduce((m, l) => Math.max(m, l.comp.ano * 12 + l.comp.mes), 0);

export function agruparObras(arquivos: readonly ArquivoLido[]): ObraHistorica[] {
  const porObra = new Map<string, ObraHistorica>();
  for (const a of arquivos) {
    const pasta = a.caminho.split(/[\\/]/)[0] ?? a.caminho;
    const id = idDaObra(pasta);
    const o = porObra.get(id) ?? {
      id,
      pasta: pasta.replace(SUFIXO, "").trim(),
      planilhas: [],
      descartadas: [],
    };
    o.planilhas.push(a);
    porObra.set(id, o);
  }
  for (const o of porObra.values()) {
    const ficam: ArquivoLido[] = [];
    for (const c of ["classica", "ampla"] as const) {
      const versoes = o.planilhas
        .filter((a) => a.planilha.construtora === c)
        .sort(
          (x, y) =>
            ultimoMes(y.planilha) - ultimoMes(x.planilha) ||
            y.modificado - x.modificado ||
            // empate total: a versão "normal" antes de "SEM ENCARGOS"/"SP"
            Number(/sem encargos|\bsp\b/i.test(x.caminho)) -
              Number(/sem encargos|\bsp\b/i.test(y.caminho)),
        );
      if (!versoes.length) continue;
      ficam.push(versoes[0]!);
      for (const v of versoes.slice(1))
        o.descartadas.push({
          caminho: v.caminho,
          motivo: v.planilha.linhas.length
            ? `versão anterior de ${versoes[0]!.caminho} (dados até ${mesTxt(ultimoMes(v.planilha))})`
            : "planilha sem lançamentos",
        });
    }
    o.planilhas = ficam;
  }
  return [...porObra.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const mesTxt = (n: number) => {
  const ano = Math.floor((n - 1) / 12);
  const mes = n - ano * 12;
  return `${String(mes).padStart(2, "0")}/${ano}`;
};

/** Período da obra pelos dados (o "início" das Premissas nem sempre foi atualizado). */
export function periodo(o: ObraHistorica): { inicio: Competencia; meses: number } | null {
  const ns = o.planilhas.flatMap((a) => a.planilha.linhas.map((l) => l.comp.ano * 12 + l.comp.mes));
  if (!ns.length) return null;
  const min = Math.min(...ns);
  const max = Math.max(...ns);
  const ano = Math.floor((min - 1) / 12);
  return { inicio: { ano, mes: min - ano * 12 }, meses: max - min + 1 };
}

// ── dados da obra sugeridos (o usuário confere e completa em obras.csv) ─────

/** Cidades que o ITO ainda não tem, com a CCT da região (decisão M9). */
export const CIDADES_NOVAS: Readonly<Record<string, { nome: string; uf: string; cct: string }>> = {
  uba: { nome: "Ubá", uf: "MG", cct: "mata" },
  lavras: { nome: "Lavras", uf: "MG", cct: "vertentes" },
  para_de_minas: { nome: "Pará de Minas", uf: "MG", cct: "centroeste" },
  varginha: { nome: "Varginha", uf: "MG", cct: "sul" },
  betim: { nome: "Betim", uf: "MG", cct: "bh" },
  ibirite: { nome: "Ibirité", uf: "MG", cct: "bh" },
  sarzedo: { nome: "Sarzedo", uf: "MG", cct: "bh" },
  lagoa_santa: { nome: "Lagoa Santa", uf: "MG", cct: "bh" },
};

/** Palavra no nome da obra → cidade (código do ITO ou das novas). */
const CIDADE_PELO_NOME: readonly [RegExp, string][] = [
  [/\buba\b/, "uba"],
  [/araxa/, "araxa"],
  [/lavras/, "lavras"],
  [/paracatu/, "paracatu"],
  [/para de minas/, "para_de_minas"],
  [/teofilo|\bt\.?o\b/, "cmucuri"],
  [/varginha/, "varginha"],
  [/montes claros/, "cnorte"],
  [/contagem/, "contagem"],
  [/betim/, "betim"],
  [/ibirite/, "ibirite"],
  [/sarzedo/, "sarzedo"],
  [/lagoa santa/, "lagoa_santa"],
  [/barreiro|gloria|caicaras|cananeias/, "bh"],
];

export function sugestaoDaObra(o: ObraHistorica): {
  nome: string;
  cliente: string;
  tipologia: string;
  cidade: string;
  observacao: string;
} {
  const titulo = o.planilhas.map((a) => a.planilha.titulo).find(Boolean) ?? "";
  const nome = (titulo.replace(/^obra\s+/i, "").trim() || o.pasta).replace(/\s+/g, " ");
  const tudo = normal(`${o.pasta} ${nome} ${o.planilhas.map((a) => a.caminho).join(" ")}`);
  const cliente = /mart minas|\bmm\b/.test(tudo)
    ? "Mart Minas"
    : /supermercados bh|\bbh\b (gloria|passos|lagoa)/.test(tudo)
      ? "Supermercados BH"
      : /villefort/.test(tudo)
        ? "Villefort"
        : /super ?luna|lnx/.test(tudo)
          ? "Super Luna"
          : /waf/.test(tudo)
            ? "WAF"
            : "";
  const tipologia = /galpao/.test(tudo)
    ? "Galpão logístico"
    : /edificio|residence/.test(tudo)
      ? "Residencial"
      : cliente || /hort ?fruti/.test(tudo)
        ? "Supermercado atacarejo"
        : "Comercial";
  const cidade = CIDADE_PELO_NOME.find(([re]) => re.test(tudo))?.[1] ?? "";
  return {
    nome,
    cliente,
    tipologia,
    cidade,
    observacao: cidade ? "" : "cidade a confirmar",
  };
}
