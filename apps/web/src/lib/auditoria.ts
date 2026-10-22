import { data, dataHora, moeda, numero, percentual, VAZIO } from "@ito/formato";

/** Módulos da auditoria (decisão M10), na ordem do menu. */
export const MODULOS: Record<string, string> = {
  obras: "Obras",
  projecoes: "Projeções",
  ccts: "CCTs",
  cidades: "Cidades",
  parametros: "Parâmetros",
  funcoes: "Funções",
  rubricas: "Rubricas",
  usuarios: "Usuários",
};

export const OPERACAO: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "apagou",
};

/** Campos técnicos que não interessam a quem lê a auditoria. */
const OCULTOS = new Set(["atualizado_em", "atualizado_por", "revisao", "criado_em", "criado_por"]);

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface Diferenca {
  campo: string;
  antes: Json | undefined;
  depois: Json | undefined;
}

const igual = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** Campos que mudaram entre a versão anterior e a nova (criação: todos os preenchidos). */
export function diferencas(
  antes: Record<string, Json> | null,
  depois: Record<string, Json> | null,
): Diferenca[] {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const r: Diferenca[] = [];
  for (const campo of campos) {
    if (OCULTOS.has(campo)) continue;
    const a = antes?.[campo];
    const d = depois?.[campo];
    if (igual(a, d)) continue;
    if (!antes && (d === null || d === "")) continue;
    if (!depois && (a === null || a === "")) continue;
    r.push({ campo, antes: a, depois: d });
  }
  return r;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Campos que são ano, código ou mês: inteiro sem separador de milhar. */
const IDENTIFICADOR = /^(ano|data_base|data_base_vigente|codigo|.+_codigo|mes|mes_idx|dia)$/;
/** Campos em R$ e em percentual (regra 3: R$ 1.234,56 e 43,96%). */
const MOEDA =
  /^(valor|salario|tarifa_local|passagem|valor_.+|.+_valor|ito_apropriado|erp_realizado)$/;
const PERCENTUAL = /(_pct|_mix_.+)$/;

/** Valor guardado em JSON, no formato brasileiro (regra 3). */
export function valorAuditado(v: Json | undefined, campo = ""): string {
  if (v === undefined || v === null || v === "") return VAZIO;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") {
    if (IDENTIFICADOR.test(campo) && Number.isInteger(v)) return String(v);
    if (MOEDA.test(campo)) return moeda(v);
    if (PERCENTUAL.test(campo)) return percentual(v);
    const casas = Math.min(4, (String(v).split(".")[1] ?? "").length);
    return numero(v, casas);
  }
  if (typeof v === "string") {
    if (DATA.test(v)) return data(v);
    if (INSTANTE.test(v)) return dataHora(v);
    return v;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object" || x === null))
      return curto(v.map((x) => valorAuditado(x, campo)).join(", "));
    return `${numero(v.length)} itens`;
  }
  // objeto (premissas, ajustes, regime…): "chave: valor" de cada item
  const itens = Object.entries(v);
  if (!itens.length) return VAZIO;
  return curto(itens.map(([k, x]) => `${nomeCampo(k)}: ${valorAuditado(x, k)}`).join("; "));
}

/** "fun · ped" a partir da chave do registro, para identificar a linha. */
export function rotuloRegistro(registro: Record<string, Json>): string {
  return Object.entries(registro)
    .map(([k, v]) => valorAuditado(v, k))
    .join(" · ");
}

const curto = (t: string) => (t.length > 160 ? `${t.slice(0, 157)}…` : t);

/** Nomes de campo legíveis; os demais trocam "_" por espaço. */
const NOMES: Record<string, string> = {
  he_mix_util: "mix de HE · dias úteis",
  he_mix_sabado: "mix de HE · sábados",
  he_mix_intervalo: "mix de HE · intervalo",
  he_mix_feriado: "mix de HE · feriados",
  area_m2: "área (m²)",
  prazo_meses: "prazo (meses)",
  data_base: "data-base",
  data_base_vigente: "data-base vigente",
  cct_id: "CCT",
  cidade_id: "cidade",
  funcao_id: "função",
  licenca_pessoa_dias: "licenças (pessoa-dias)",
  ferias_pessoa_dias: "férias (pessoa-dias)",
  absenteismo_pct: "absenteísmo",
  he_media: "HE média",
  quantidades_manuais: "quantidades informadas",
  iss_pct: "ISS",
};
export const nomeCampo = (c: string) => NOMES[c] ?? c.replace(/_/g, " ");
