/** Cadastros sintéticos para os testes da carga (matrículas fictícias, sem nomes). */
import type { Contexto, Funcao, Tabela } from "@ito/motor";
import { ENCARGOS_REFERENCIA } from "@ito/motor";
import type { Cadastro, DadosObra } from "./montagem";

const funcao = (
  id: string,
  grupo: Funcao["grupo"],
  fatorHe: number,
  vinculo: Funcao["vinculo"] = "clt",
): Funcao => ({
  id,
  grupo,
  vinculo,
  escalaArea: grupo === "direta",
  exames: { adm: 150, perAnual: 105, dem: 150 },
  periculosidadePct: 0,
  insalubridadePctSm: 0,
  horasNoturnasMes: 0,
  ferramentasMes: 0,
  fatorHe,
});

export const FUNCOES = [
  funcao("ped", "direta", 1.1),
  funcao("serv", "direta", 0.9),
  funcao("mestre", "indireta", 0.4),
  funcao("estag", "adm", 1, "estagio"),
];

export const CTX: Contexto = {
  funcoes: FUNCOES,
  beneficios: [{ id: "refeicao", soForaSede: false }],
  calendario: { carnaval: false, corpusChristi: true, feriadosEmpresa: [] },
};

export const TABELA: Tabela = {
  salarios: { ped: 1650, serv: 1100, mestre: 4200, estag: 1100 },
  beneficios: { refeicao: 200 },
  gratificacoes: {},
  encargos: ENCARGOS_REFERENCIA,
  heAdicionalPct: { util: 100, sabado: 100, intervalo: 50, feriado: 100 },
  divisor: 220,
  modoDias: "calendario",
  sabadoTrabalhado: false,
  diasFixos: 22,
  dsrFixoPct: 20,
  vtDiaria: 11,
  fatorRescisao: 0.9,
  salarioMinimo: 1518,
  adicionalNoturnoPct: 20,
  salarioFamilia: { teto: 1906.04, cota: 65 },
};

const rub = (
  codigo: number,
  nome: string,
  tipo: "provento" | "desconto",
  componente: "sal" | "he" | "faltas" | "nao",
  tipoHe: "util" | "sabado" | null = null,
) => ({ codigo, nome, tipo, componente, baseProvisoes: componente !== "nao", tipoHe });

export const CADASTRO: Cadastro = {
  funcoes: FUNCOES,
  nomesFuncoes: {
    ped: "Pedreiro",
    serv: "Servente",
    mestre: "Mestre de obras",
    estag: "Estagiário",
  },
  sinonimos: { "SERVENTE DE OBRAS": "serv" },
  rubricas: [
    rub(1, "HORAS NORMAIS", "provento", "sal"),
    rub(200, "HORAS EXTRAS 100%", "provento", "he", "util"),
    rub(201, "HORAS EXTRAS SÁBADO", "provento", "he", "sabado"),
    rub(40, "HORAS FALTAS", "desconto", "faltas"),
    rub(998, "I.N.S.S.", "desconto", "nao"),
  ],
};

export const DADOS: DadosObra = {
  id: "obra_teste",
  nome: "Obra Teste",
  cliente: "Cliente",
  tipologia: "Galpão",
  cidadeId: null,
  area: 2000,
  inicio: { ano: 2025, mes: 3 },
  meses: 2,
  dataBase: 2025,
  trocas: [],
  feriados: [],
  premissas: {},
  regime: {},
};
