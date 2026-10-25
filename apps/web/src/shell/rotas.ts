/** Menu do ITO (PRD §3): Análise / Dados / Configuração, e Administração (M10). */
import type { Usuario } from "../lib/supabase";
import { podeAuditar, podeGerirUsuarios } from "../lib/permissoes";

export type Icone =
  | "base"
  | "comp"
  | "proj"
  | "carga"
  | "cid"
  | "param"
  | "func"
  | "rub"
  | "audit"
  | "users"
  | "perf";

export interface Destino {
  caminho: string;
  nome: string;
  icone: Icone;
  grupo: "Análise" | "Dados" | "Configuração" | "Administração";
  /** Uma linha sobre a tela (PRD), usada no cabeçalho e na busca. */
  resumo: string;
  /** Milestone em que a tela ganha conteúdo (PLAN). */
  milestone: string;
  /** Só aparece para quem pode usar a tela (a RLS continua mandando). */
  visivel?: (u: Usuario | null | undefined) => boolean;
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
    resumo:
      "Tabela da empresa por data-base: salários, encargos, benefícios, HE, VT, rescisões, adicionais e calendário.",
    milestone: "M1",
  },
  {
    caminho: "/funcoes",
    nome: "Funções padrão",
    icone: "func",
    grupo: "Configuração",
    resumo:
      "As funções em que o ITO organiza o histograma: grupo, conta do plano de contas, exames por tipo, adicionais legais e ferramentas. Os sinônimos ligam cada folha à função certa.",
    milestone: "M1",
  },
  {
    caminho: "/rubricas",
    nome: "Rubricas da folha",
    icone: "rub",
    grupo: "Configuração",
    resumo:
      "Dicionário das verbas da folha: o código de cada rubrica, se é provento, desconto ou informativa, como entra no custo e se compõe a base das provisões.",
    milestone: "M1",
  },
  {
    caminho: "/auditoria",
    nome: "Auditoria",
    icone: "audit",
    grupo: "Administração",
    resumo:
      "Quem alterou parâmetros, CCTs, cidades, funções, rubricas, obras, projeções e usuários, com a versão anterior.",
    milestone: "M10",
    visivel: podeAuditar,
  },
  {
    caminho: "/usuarios",
    nome: "Usuários",
    icone: "users",
    grupo: "Administração",
    resumo:
      "Convidar pessoas, mudar perfil e admin, desativar e reativar, e o que cada perfil pode fazer no ITO.",
    milestone: "M10",
    visivel: podeGerirUsuarios,
  },
  {
    caminho: "/desempenho",
    nome: "Desempenho",
    icone: "perf",
    grupo: "Administração",
    resumo:
      "Quanto as telas levam para abrir no navegador de quem usa o ITO e os erros que aparecem, sem nome nem obra.",
    milestone: "M14",
    visivel: podeGerirUsuarios,
  },
];

export const GRUPOS = ["Análise", "Dados", "Configuração", "Administração"] as const;

/** Itens do menu que a pessoa vê. */
export function menuDe(u: Usuario | null | undefined): Destino[] {
  return MENU.filter((d) => !d.visivel || d.visivel(u));
}

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

export function buscarDestinos(q: string, u?: Usuario | null): Destino[] {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return menuDe(u).filter((d) => {
    const alvo = normalizar(`${d.nome} ${d.grupo} ${d.resumo}`);
    return termos.every((t) => alvo.includes(t));
  });
}
