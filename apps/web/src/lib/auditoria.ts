import { data, dataHora, numero, VAZIO } from "@ito/formato";

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

/** Valor guardado em JSON, no formato brasileiro (regra 3). */
export function valorAuditado(v: Json | undefined, campo = ""): string {
  if (v === undefined || v === null || v === "") return VAZIO;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") {
    if (IDENTIFICADOR.test(campo) && Number.isInteger(v)) return String(v);
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
      return v.map((x) => valorAuditado(x)).join(", ");
    return `${numero(v.length)} itens`;
  }
  return `${numero(Object.keys(v).length)} campos`;
}

/** "fun · ped" a partir da chave do registro, para identificar a linha. */
export function rotuloRegistro(registro: Record<string, Json>): string {
  return Object.entries(registro)
    .map(([k, v]) => valorAuditado(v, k))
    .join(" · ");
}
