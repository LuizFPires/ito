/** Menu do ITO (PRD §3): Análise / Dados / Configuração. */

export type Icone = "base" | "comp" | "proj" | "carga" | "cid" | "param" | "func" | "rub";

export interface Destino {
  caminho: string;
  nome: string;
  icone: Icone;
  grupo: "Análise" | "Dados" | "Configuração";
  /** Uma linha sobre a tela (PRD), usada no cabeçalho e na busca. */
  resumo: string;
  /** Milestone em que a tela ganha conteúdo (PLAN). */
  milestone: string;
}

export const MENU: readonly Destino[] = [
  {
    caminho: "/base",
    nome: "Base histórica",
    icone: "base",
    grupo: "Análise",
    resumo: "Obras concluídas com efetivo, custos e indicadores, para comparar ou projetar.",
    milestone: "M5",
  },
  {
    caminho: "/comparar",
    nome: "Comparar obras",
    icone: "comp",
    grupo: "Análise",
    resumo: "De 2 a 4 obras lado a lado, alinhadas por mês relativo e a valores vigentes.",
    milestone: "M6",
  },
  {
    caminho: "/projecoes",
    nome: "Projeções",
    icone: "proj",
    grupo: "Análise",
    resumo: "Histograma e custo mensal de MO de obras novas, a partir do histórico.",
    milestone: "M7",
  },
  {
    caminho: "/carga",
    nome: "Carga de dados",
    icone: "carga",
    grupo: "Dados",
    resumo: "Levar uma obra concluída para a base, com conferência da folha e do ERP.",
    milestone: "M4",
  },
  {
    caminho: "/cidades",
    nome: "Cidades e CCTs",
    icone: "cid",
    grupo: "Configuração",
    resumo: "Convenções coletivas e cidades: salários, gratificações, VT, ISS e feriados.",
    milestone: "M2",
  },
  {
    caminho: "/parametros",
    nome: "Parâmetros",
    icone: "param",
    grupo: "Configuração",
    resumo: "Tabela da empresa por data-base: encargos, HE, benefícios e calendário.",
    milestone: "M1",
  },
  {
    caminho: "/funcoes",
    nome: "Funções padrão",
    icone: "func",
    grupo: "Configuração",
    resumo: "Grupo, conta, escala, exames, adicionais, ferramentas e sinônimos de cada função.",
    milestone: "M1",
  },
  {
    caminho: "/rubricas",
    nome: "Rubricas da folha",
    icone: "rub",
    grupo: "Configuração",
    resumo: "Dicionário de rubricas: tipo, como entra no custo e base de provisões.",
    milestone: "M1",
  },
];

export const GRUPOS = ["Análise", "Dados", "Configuração"] as const;

/** Rotas de detalhe ficam marcadas no item do menu a que pertencem. */
export function itemAtivo(caminho: string): string | undefined {
  if (caminho.startsWith("/obras/")) return "/base";
  return MENU.find((d) => caminho === d.caminho || caminho.startsWith(d.caminho + "/"))?.caminho;
}

/** Busca sem acento e sem caixa, por nome e resumo. */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function buscarDestinos(q: string): Destino[] {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return MENU.filter((d) => {
    const alvo = normalizar(`${d.nome} ${d.grupo} ${d.resumo}`);
    return termos.every((t) => alvo.includes(t));
  });
}
