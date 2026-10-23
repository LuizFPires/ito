/** Cadastros sintéticos para os testes da carga (matrículas fictícias, sem nomes). */
import type { Contexto, Funcao, Tabela } from "@ito/motor";
import { ENCARGOS_REFERENCIA } from "@ito/motor";
import { lerFolha } from "./leitores";
import type { Cadastro, DadosObra } from "./montagem";

const funcao = (
  id: string,
  escalaArea: boolean,
  fatorHe: number,
  vinculo: Funcao["vinculo"] = "clt",
): Funcao => ({
  id,
  vinculo,
  escalaArea,
  exames: { adm: 150, perAnual: 105, dem: 150 },
  periculosidadePct: 0,
  insalubridadePctSm: 0,
  horasNoturnasMes: 0,
  ferramentasMes: 0,
  fatorHe,
});

export const FUNCOES = [
  funcao("ped", true, 1.1),
  funcao("serv", true, 0.9),
  funcao("mestre", false, 0.4),
  funcao("estag", false, 1, "estagio"),
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

export const RUB = [
  "Competência",
  "Matrícula",
  "Função",
  "Rubrica",
  "Descrição",
  "Referência",
  "Valor",
];
export const PES = [
  "Competência",
  "Matrícula",
  "Função",
  "Dias de vínculo",
  "Admitido",
  "Desligado",
  "Faltas (h)",
  "Dias de licença",
  "Dias de férias",
  "Obra onde trabalhou",
];

// mar/25: pedreiro 1001 (admitido, 11 h de falta, 10 h HE úteis + 5 h sábado) e servente 1002
// abr/25: 1001 desligado, 1003 admitido com 15 dias; 1002 trabalhou na Obra B (realocada)
export const FOLHA = lerFolha({
  Rubricas: [
    RUB,
    ["03/2025", 1001, "PEDREIRO", 1, "HORAS NORMAIS", 220, 1650],
    ["03/2025", 1001, "PEDREIRO", 200, "HE 100%", 10, 150],
    ["03/2025", 1001, "PEDREIRO", 201, "HE SÁBADO", 5, 75],
    ["03/2025", 1002, "SERVENTE DE OBRAS", 1, "HORAS NORMAIS", 220, 1100],
    ["04/2025", 1001, "PEDREIRO", 1, "HORAS NORMAIS", 220, 1650],
    ["04/2025", 1003, "PEDREIRO", 1, "HORAS NORMAIS", 110, 825],
    ["04/2025", 1002, "SERVENTE DE OBRAS", 1, "HORAS NORMAIS", 220, 1100],
    ["04/2025", 1003, "PEDREIRO", 7777, "PRÊMIO ASSIDUIDADE", 0, 50],
  ],
  Pessoas: [
    PES,
    ["03/2025", 1001, "PEDREIRO", "", "S", "", 11, 0, 0, ""],
    ["03/2025", 1002, "SERVENTE DE OBRAS", "", "", "", 0, 0, 0, ""],
    ["04/2025", 1001, "PEDREIRO", "", "", "S", 0, 0, 0, ""],
    ["04/2025", 1003, "PEDREIRO", 15, "S", "", 0, 0, 0, ""],
    ["04/2025", 1002, "SERVENTE DE OBRAS", "", "", "", 0, 0, 0, "OBRA B"],
  ],
});
