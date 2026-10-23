/**
 * Função da planilha histórica → função padrão do ITO (decisão M9: funções fora das 14 viram
 * funções novas; variações vão para a função existente). Regras por palavra, na ordem; a tabela
 * gerada (`docs/migracao/funcoes.csv`) é revisável e manda sobre as regras.
 */
import { normal } from "./historico";

/**
 * Funções que a migração cria (as 14 do ITO já existem): se crescem com a área da obra e de qual
 * função do ITO herdam o cadastro até a função nova existir (exames, adicionais, fator de HE).
 */
export const FUNCOES_NOVAS: Readonly<
  Record<string, { nome: string; escalaArea: boolean; modelo: "ped" | "encar" | "admin" }>
> = {
  eng: { nome: "Engenheiro", escalaArea: false, modelo: "encar" },
  superv: { nome: "Supervisor de obra", escalaArea: false, modelo: "encar" },
  topog: { nome: "Topografia", escalaArea: false, modelo: "encar" },
  planej: { nome: "Analista de planejamento", escalaArea: false, modelo: "encar" },
  tecenf: { nome: "Técnico de enfermagem do trabalho", escalaArea: false, modelo: "encar" },
  auxger: { nome: "Auxiliar de serviços gerais", escalaArea: false, modelo: "encar" },
  opbet: { nome: "Operador de betoneira", escalaArea: true, modelo: "ped" },
  pintor: { nome: "Pintor", escalaArea: true, modelo: "ped" },
  serralh: { nome: "Serralheiro", escalaArea: true, modelo: "ped" },
  compr: { nome: "Comprador", escalaArea: false, modelo: "admin" },
  rh: { nome: "Analista de RH", escalaArea: false, modelo: "admin" },
  geradm: { nome: "Gerente administrativo", escalaArea: false, modelo: "admin" },
  motoboy: { nome: "Moto boy", escalaArea: false, modelo: "admin" },
  outras: { nome: "Outras funções (migração)", escalaArea: false, modelo: "encar" },
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
