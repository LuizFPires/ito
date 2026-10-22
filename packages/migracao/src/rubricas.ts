/**
 * Classificação sugerida para rubricas da folha que o ITO ainda não tem (M9), pelo sinal da
 * planilha e pelo nome. Vai para o relatório para o DP/RH revisar no dicionário de rubricas.
 */
import type { ComponenteRubrica, TipoRubrica } from "@ito/carga";
import { normal } from "./historico";

export interface Classificacao {
  tipo: TipoRubrica;
  componente: ComponenteRubrica;
  tipoHe: "util" | "sabado" | "intervalo" | "feriado" | null;
  baseProvisoes: boolean;
}

const BASE: readonly ComponenteRubrica[] = ["sal", "extras", "he", "dsr"];
const c = (
  tipo: TipoRubrica,
  componente: ComponenteRubrica,
  tipoHe: Classificacao["tipoHe"] = null,
): Classificacao => ({
  tipo,
  componente,
  tipoHe,
  baseProvisoes: tipo === "provento" && BASE.includes(componente),
});

/** Colunas do .xlsb sem código na linha 5: código do ITO pelo nome. */
export const SEM_CODIGO: readonly [RegExp, number, string][] = [
  [/^arredondamento/, 990, "ARREDONDAMENTO"],
  [/^bolsa estagio/, 300, "BOLSA ESTÁGIO"],
  [/^ajuda de custo/, 9003, "AJUDA DE CUSTO (MIGRAÇÃO)"],
  [/^salario familia/, 320, "SALÁRIO-FAMÍLIA"],
];

export function classificarRubrica(descricao: string, sinal: "+" | "-" | ""): Classificacao {
  const n = normal(descricao).replace(/^[+-]\s*/, "");
  // quantidades (dias), valores que o motor já calcula ou que só movem dinheiro
  if (/^dias faltas/.test(n)) return c("informativo", "info");
  if (/vale transporte|estouro|adiantamento salarial|arredondamento/.test(n))
    return c("informativo", "info");
  if (/^desconto adiantamento/.test(n)) return c("informativo", "info");
  if (sinal === "-" || /^desc|inss|irrf|imposto|contribuicao|sindicato|negocial/.test(n)) {
    if (/falta/.test(n)) return c("desconto", "faltas");
    return c("desconto", "nao");
  }
  if (/falta/.test(n)) return c("desconto", "faltas");
  if (/horas extras/.test(n) && !/media|diferenca/.test(n)) return c("provento", "he", "util");
  if (/rescis|aviso previo|indeniza|multa/.test(n)) return c("provento", "resc");
  if (/13|ferias|fer\b/.test(n)) return c("provento", "provpaga");
  if (/salario familia/.test(n)) return c("provento", "compgps");
  if (/licenca remunerada|ausencia justificada|diferenca ?de salarios|afast/.test(n))
    return c("provento", "sal");
  if (/ajuda de custo/.test(n)) return c("provento", "ferr");
  if (sinal === "+") return c("provento", "extras");
  return c("informativo", "info");
}
