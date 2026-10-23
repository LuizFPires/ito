/**
 * Linhas do banco → entrada do motor (`@ito/motor`). Percentuais continuam de 0 a 100; o motor
 * converte. Valores numéricos do PostgREST passam por Number() (numeric pode vir como texto).
 */
import type { Contexto, Funcao, ItemEncargo, Tabela } from "@ito/motor";
import type { Database } from "./tipos-banco";

type T = Database["public"]["Tables"];
type LinhaFuncao = T["funcoes"]["Row"];
type LinhaDataBase = T["datas_base"]["Row"];
type LinhaEncargo = T["data_base_encargos"]["Row"];

export function funcaoDoBanco(f: LinhaFuncao): Funcao {
  return {
    id: f.id,
    vinculo: f.vinculo,
    escalaArea: f.escala_area,
    exames: {
      adm: Number(f.exame_adm),
      perAnual: Number(f.exame_per_anual),
      dem: Number(f.exame_dem),
    },
    periculosidadePct: Number(f.peric_pct),
    insalubridadePctSm: Number(f.insal_pct_sm),
    horasNoturnasMes: Number(f.horas_noturnas_mes),
    ferramentasMes: Number(f.ferramentas_mes),
    fatorHe: Number(f.fator_he),
  };
}

export const encargoDoBanco = (e: LinhaEncargo): ItemEncargo => ({
  id: e.id,
  grupo: e.grupo,
  nome: e.nome,
  baseCalcPct: Number(e.base_calc_pct),
  aliqClt: Number(e.aliq_clt),
  aliqSp: Number(e.aliq_sp),
});

/** Tabela da empresa de uma data-base (sem CCT: gratificações fixas vazias). */
export function tabelaDoBanco(
  d: LinhaDataBase,
  salarios: Readonly<Record<string, number>>,
  beneficios: Readonly<Record<string, number>>,
  encargos: readonly LinhaEncargo[],
): Tabela {
  return {
    salarios,
    beneficios,
    gratificacoes: {},
    encargos: [...encargos].sort((a, b) => a.ordem - b.ordem).map(encargoDoBanco),
    heAdicionalPct: {
      util: Number(d.he_adicional_util),
      sabado: Number(d.he_adicional_sabado),
      intervalo: Number(d.he_adicional_intervalo),
      feriado: Number(d.he_adicional_feriado),
    },
    divisor: Number(d.divisor),
    modoDias: d.modo_dias,
    sabadoTrabalhado: d.sabado_trabalhado,
    diasFixos: Number(d.dias_fixos),
    dsrFixoPct: Number(d.dsr_fixo_pct),
    vtDiaria: Number(d.vt_diaria_ref),
    fatorRescisao: Number(d.fator_rescisao),
    salarioMinimo: Number(d.salario_minimo),
    adicionalNoturnoPct: Number(d.adicional_noturno_pct),
    salarioFamilia: { teto: Number(d.sf_teto), cota: Number(d.sf_cota) },
  };
}

export function contextoDoBanco(
  funcoes: readonly LinhaFuncao[],
  beneficios: readonly T["beneficios"]["Row"][],
  parametros: Pick<T["parametros"]["Row"], "carnaval" | "corpus_christi">,
  feriadosEmpresa: readonly T["feriados_empresa"]["Row"][],
): Contexto {
  return {
    funcoes: funcoes.map(funcaoDoBanco),
    beneficios: [...beneficios]
      .sort((a, b) => a.ordem - b.ordem)
      .map((b) => ({ id: b.id, soForaSede: b.so_fora_sede })),
    calendario: {
      carnaval: parametros.carnaval,
      corpusChristi: parametros.corpus_christi,
      feriadosEmpresa: feriadosEmpresa.map((f) => ({ data: f.data, nome: f.nome })),
    },
  };
}
