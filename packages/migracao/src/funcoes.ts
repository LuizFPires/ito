/**
 * Função da planilha histórica → função padrão do ITO (decisão M9: funções fora das 14 viram
 * funções novas; variações vão para a função existente). Regras por palavra, na ordem; a tabela
 * gerada (`docs/migracao/funcoes.csv`) é revisável e manda sobre as regras.
 */
import { normal } from "./historico";

export type Grupo = "direta" | "indireta" | "adm";

/** Funções que a migração cria (as 14 do ITO já existem). */
export const FUNCOES_NOVAS: Readonly<Record<string, { nome: string; grupo: Grupo }>> = {
  eng: { nome: "Engenheiro", grupo: "indireta" },
  superv: { nome: "Supervisor de obra", grupo: "indireta" },
  topog: { nome: "Topografia", grupo: "indireta" },
  planej: { nome: "Analista de planejamento", grupo: "indireta" },
  tecenf: { nome: "Técnico de enfermagem do trabalho", grupo: "indireta" },
  auxger: { nome: "Auxiliar de serviços gerais", grupo: "indireta" },
  opbet: { nome: "Operador de betoneira", grupo: "direta" },
  pintor: { nome: "Pintor", grupo: "direta" },
  serralh: { nome: "Serralheiro", grupo: "direta" },
  compr: { nome: "Comprador", grupo: "adm" },
  rh: { nome: "Analista de RH", grupo: "adm" },
  geradm: { nome: "Gerente administrativo", grupo: "adm" },
  motoboy: { nome: "Moto boy", grupo: "adm" },
  outras: { nome: "Outras funções (migração)", grupo: "indireta" },
};

/** Regras: a primeira cujo padrão aparece no texto (sem acento, minúsculo) decide. */
const REGRAS: readonly [RegExp, string][] = [
  [/estagi/, "estag"],
  [/enferm|\benf\b/, "tecenf"],
  [/(tec|tecnic\w*|aux\w*)\.? ?(em |de |do )?seg/, "tecseg"],
  [/seg(uranca)? (do )?trab/, "tecseg"],
  [/edifica|edifi/, "auxeng"],
  [/topogra/, "topog"],
  [/planejamento/, "planej"],
  [/engenheir/, "eng"],
  [/(aux|assist)\w*\.? (de |em )?engenharia/, "auxeng"],
  [/supervisor/, "superv"],
  [/mestre/, "mestre"],
  [/almox/, "almox"],
  [/encarregad|sub enc/, "encar"],
  [/compra/, "compr"],
  [/gerente/, "geradm"],
  [/\brh\b|pessoal|recursos humanos/, "rh"],
  [/administrat|adm\b|financeir/, "admin"],
  [/moto ?boy/, "motoboy"],
  [/servicos gerais|serv\w* gerais/, "auxger"],
  [/betoneira/, "opbet"],
  [/guincho/, "opg"],
  [/armador|armacao/, "arm"],
  [/carpint/, "carp"],
  [/eletric/, "eletr"],
  [/serralh/, "serralh"],
  [/pintor/, "pintor"],
  [/vigia/, "vigia"],
  [/meio oficial|pedreir/, "ped"],
  [/servente|ajudante/, "serv"],
];

/**
 * Função do ITO para um texto da planilha: tabela revisada > sinônimo já cadastrado > regras >
 * "outras". `classe` (só no .xlsm) desempata quando o texto não diz nada.
 */
export function funcaoDoHistorico(
  texto: string,
  classe: string,
  tabela: ReadonlyMap<string, string>,
  sinonimos: ReadonlyMap<string, string>,
): { id: string; origem: "tabela" | "sinonimo" | "regra" | "classe" | "outras" } {
  const t = texto.trim().toUpperCase().replace(/\s+/g, " ");
  const daTabela = tabela.get(t);
  if (daTabela) return { id: daTabela, origem: "tabela" };
  const sin = sinonimos.get(t);
  if (sin) return { id: sin, origem: "sinonimo" };
  const n = normal(t);
  for (const [re, id] of REGRAS) if (re.test(n)) return { id, origem: "regra" };
  const c = normal(classe);
  if (c && c !== "n/a" && c !== "0")
    for (const [re, id] of REGRAS) if (re.test(c)) return { id, origem: "classe" };
  return { id: "outras", origem: "outras" };
}
