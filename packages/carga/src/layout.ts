/**
 * Layout padrão do ITO para os arquivos da carga (decisão M4). É a fonte única: o leitor usa
 * estas colunas e o modelo .xlsx para baixar é gerado a partir delas. Adaptadores para as
 * exportações reais do sistema de folha e do ERP convertem para este layout.
 */
import type { Aba } from "./planilha";

const COMP = {
  chave: "competencia",
  titulo: "Competência",
  aceita: ["Mês", "Mes/Ano", "Período", "Referência mês"],
  obrigatoria: true,
  ajuda: "Mês da folha: mm/aaaa (03/2025) ou mar/25.",
  exemplo: "03/2025",
} as const;
const MAT = {
  chave: "matricula",
  titulo: "Matrícula",
  aceita: ["Matricula", "Chapa", "Registro", "Cód. funcionário", "Codigo funcionario"],
  obrigatoria: true,
  ajuda: "Matrícula do trabalhador. Não informe nome nem CPF: o ITO não guarda.",
  exemplo: "1001",
} as const;
const FUN = {
  chave: "funcao",
  titulo: "Função",
  aceita: ["Funcao", "Cargo"],
  obrigatoria: true,
  ajuda: "Função como está na folha. Na carga, cada nome vira uma função padrão do ITO.",
  exemplo: "PEDREIRO",
} as const;

export const ABA_RUBRICAS: Aba<
  "competencia" | "matricula" | "funcao" | "codigo" | "descricao" | "referencia" | "valor"
> = {
  nome: "Rubricas",
  aceita: ["Folha", "Lançamentos"],
  colunas: [
    COMP,
    MAT,
    FUN,
    {
      chave: "codigo",
      titulo: "Rubrica",
      aceita: ["Código", "Codigo", "Cód. rubrica", "Evento", "Verba"],
      obrigatoria: true,
      ajuda: "Código numérico da rubrica (evento) na folha.",
      exemplo: 1,
    },
    {
      chave: "descricao",
      titulo: "Descrição",
      aceita: ["Descricao", "Nome da rubrica", "Descrição do evento"],
      ajuda: "Nome da rubrica; usado para classificar rubricas novas.",
      exemplo: "HORAS NORMAIS",
    },
    {
      chave: "referencia",
      titulo: "Referência",
      aceita: ["Referencia", "Ref.", "Quantidade", "Horas"],
      ajuda: "Horas ou dias da rubrica (nas HE, as horas pagas de cada tipo).",
      exemplo: 220,
    },
    {
      chave: "valor",
      titulo: "Valor",
      aceita: ["Valor (R$)", "Valor R$"],
      obrigatoria: true,
      ajuda: "Valor em R$ (descontos podem vir positivos: o tipo da rubrica decide).",
      exemplo: "1.650,00",
    },
  ],
};

export const ABA_PESSOAS: Aba<
  | "competencia"
  | "matricula"
  | "funcao"
  | "dias"
  | "admitido"
  | "desligado"
  | "faltas"
  | "licenca"
  | "ferias"
  | "obra"
> = {
  nome: "Pessoas",
  aceita: ["Vínculos", "Efetivo"],
  colunas: [
    COMP,
    MAT,
    FUN,
    {
      chave: "dias",
      titulo: "Dias de vínculo",
      aceita: ["Dias", "Dias no mês", "Dias trabalhados"],
      ajuda: "Dias do mês com vínculo na obra (mês cheio = dias do mês). Vazio = mês cheio.",
      exemplo: 31,
    },
    {
      chave: "admitido",
      titulo: "Admitido",
      aceita: ["Admissão"],
      ajuda: "S se foi admitido nesta competência.",
      exemplo: "N",
    },
    {
      chave: "desligado",
      titulo: "Desligado",
      aceita: ["Demitido", "Demissão", "Rescisão"],
      ajuda: "S se foi desligado nesta competência.",
      exemplo: "N",
    },
    {
      chave: "faltas",
      titulo: "Faltas (h)",
      aceita: ["Faltas", "Horas de falta"],
      ajuda: "Horas de falta no mês.",
      exemplo: 8,
    },
    {
      chave: "licenca",
      titulo: "Dias de licença",
      aceita: ["Licença", "Licenca"],
      ajuda: "Dias de licença sem remuneração.",
      exemplo: 0,
    },
    {
      chave: "ferias",
      titulo: "Dias de férias",
      aceita: ["Férias", "Ferias"],
      ajuda: "Dias de férias gozadas no mês.",
      exemplo: 0,
    },
    {
      chave: "obra",
      titulo: "Obra onde trabalhou",
      aceita: ["MDO realocada", "Obra de destino"],
      ajuda: "Só se trabalhou em outra obra (MDO realocada): o nome dela.",
      exemplo: "",
    },
  ],
};

export const ABA_RESUMO: Aba<"competencia" | "proventos"> = {
  nome: "Resumo",
  aceita: ["Resumo da folha", "Totais"],
  colunas: [
    COMP,
    {
      chave: "proventos",
      titulo: "Total de proventos",
      aceita: ["Proventos", "Total proventos"],
      obrigatoria: true,
      ajuda: "Total de proventos do resumo da folha, para conferir a leitura.",
      exemplo: "182.450,32",
    },
  ],
};

export const ABA_PONTO: Aba<"competencia" | "matricula" | "he" | "faltas"> = {
  nome: "Ponto",
  aceita: ["Cartão de ponto", "Cartao de ponto"],
  colunas: [
    COMP,
    MAT,
    {
      chave: "he",
      titulo: "Horas extras",
      aceita: ["HE", "Horas extras (h)", "Extras"],
      obrigatoria: true,
      ajuda: "Horas extras apuradas no mês (todos os tipos).",
      exemplo: 12.5,
    },
    {
      chave: "faltas",
      titulo: "Faltas (h)",
      aceita: ["Faltas", "Horas de falta"],
      obrigatoria: true,
      ajuda: "Horas de falta apuradas.",
      exemplo: 8,
    },
  ],
};

export const ABA_VT: Aba<"competencia" | "matricula" | "valor"> = {
  nome: "VT",
  aceita: ["Vale-transporte", "Vale transporte"],
  colunas: [
    COMP,
    MAT,
    {
      chave: "valor",
      titulo: "Valor",
      aceita: ["Valor (R$)", "Crédito", "Credito", "Recarga"],
      obrigatoria: true,
      ajuda: "Crédito de VT do mês, em R$.",
      exemplo: "242,00",
    },
  ],
};

export const ABA_ERP: Aba<"competencia" | "conta" | "valor"> = {
  nome: "Realizado",
  aceita: ["ERP", "Realizado ERP"],
  colunas: [
    COMP,
    {
      chave: "conta",
      titulo: "Conta",
      aceita: ["Conta contábil", "Conta PC", "Plano de contas"],
      obrigatoria: true,
      ajuda: "Conta do plano de contas (04.03.01).",
      exemplo: "04.03.01",
    },
    {
      chave: "valor",
      titulo: "Valor",
      aceita: ["Valor (R$)", "Realizado"],
      obrigatoria: true,
      ajuda: "Realizado no ERP no mês, em R$.",
      exemplo: "48.210,77",
    },
  ],
};

/** Arquivos da carga e as abas de cada um (o modelo .xlsx tem uma aba por item). */
export const MODELOS = {
  folha: { arquivo: "modelo_folha_ito.xlsx", abas: [ABA_RUBRICAS, ABA_PESSOAS, ABA_RESUMO] },
  ponto: { arquivo: "modelo_ponto_ito.xlsx", abas: [ABA_PONTO] },
  vt: { arquivo: "modelo_vt_ito.xlsx", abas: [ABA_VT] },
  erp: { arquivo: "modelo_erp_ito.xlsx", abas: [ABA_ERP] },
} as const;
export type TipoArquivo = keyof typeof MODELOS | "nf";
