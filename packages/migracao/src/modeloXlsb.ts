/**
 * Modelo .xlsb (2023–2026): aba Histograma com uma linha por matrícula e competência e uma coluna
 * por rubrica da folha (código na linha 5, sinal na linha 2, nome na linha 6). Só valores em R$:
 * horas de HE e de falta e a fração do mês são estimadas (marcadas no relatório).
 * Nunca lê a coluna do nome (coluna C) nem a descrição da aba Adicionais (traz nomes). As colunas
 * fixas (matrícula, função, competência) são conferidas pelo cabeçalho antes da leitura.
 */
import type { Competencia, Construtora } from "@ito/carga";
import { moeda } from "@ito/formato";
import type {
  Abas,
  Aviso,
  Celula,
  LinhaHistorico,
  PlanilhaHistorica,
  RubricaLida,
} from "./historico";
import { competenciaDe, normal, numero } from "./historico";
import { SEM_CODIGO } from "./rubricas";

const COL = { matricula: 1, funcao: 4, status: 5, competencia: 6, salarioBase: 12 } as const;
const LINHA = { sinal: 1, codigo: 4, nome: 5, dados: 6 } as const;

const diasNoMes = (c: Competencia) => new Date(Date.UTC(c.ano, c.mes, 0)).getUTCDate();

/** Rubrica de HE pelo nome (não as médias, reflexos e DSR). */
const ehHe = (nome: string) =>
  /horas extras/.test(nome) && !/media|reflexo|dsr|diferenca/.test(nome);
const ehFalta = (nome: string) => /^horas faltas$|^horas faltas parcial/.test(nome);
const ehRescisao = (nome: string) => /rescis|aviso previo|indeniza/.test(nome);
/**
 * Coluna sem sinal na planilha (a linha de sinais só cobre as primeiras colunas; regra conferida
 * com a coluna "Proventos" de cada linha): dias de falta (quantidade) ficam fora; "(-)",
 * contribuição, desconto e impostos descontam; o resto (inclusive "ARREDONDAMENTO (+)") é provento.
 */
export function sinalPeloNome(nome: string): "+" | "-" | "" {
  const n = normal(nome);
  if (!n || /^dias faltas|adiantamento|vale transporte|2a via/.test(n)) return "";
  if (/\(-\)|contribuicao|^desc|inss|irrf|imposto|emprest|credito trabalhador/.test(n)) return "-";
  return "+";
}

const ehHorasNormais = (codigo: number, nome: string) =>
  codigo === 1 || /saldo de salario|afast\. p\/doenca/.test(nome);

/**
 * Títulos que abrem o bloco de totais da planilha (custo, encargos, provisões, líquido): as
 * rubricas param antes deles, mesmo nas planilhas sem a coluna "Proventos" (revisão M9).
 */
const TOTAIS =
  /^(proventos|descontos|∑|custo|provisoes|fgts$|base inss|exc inss|remuneracao para provisoes|tributos|pagamento salarial|liquido trct|inss \(empreg|irrf$|desc\. taxa)/;

export function fimDasRubricas(nomes: readonly Celula[]): number {
  for (let c = COL.salarioBase + 1; c < nomes.length; c++)
    if (TOTAIS.test(normal(nomes[c]))) return c;
  return nomes.length;
}

/** Confere o cabeçalho das colunas fixas: se a versão mudou, recusa (o nome cairia na função). */
export function conferirCabecalho(nomes: readonly Celula[], arquivo: string) {
  const ok =
    /^cod/.test(normal(nomes[COL.matricula])) &&
    /^funcao/.test(normal(nomes[COL.funcao])) &&
    /^competencia/.test(normal(nomes[COL.competencia])) &&
    /salario base/.test(normal(nomes[COL.salarioBase]));
  if (!ok)
    throw new Error(
      `${arquivo}: aba Histograma fora do layout esperado (matrícula na B, função na E, competência na G, salário base na M). Ajuste o conversor antes de migrar.`,
    );
}

export interface ColunaXlsb {
  col: number;
  /** código da linha 5 (nem sempre atualizado quando a coluna foi renomeada) */
  codigoPlanilha: number | null;
  titulo: string;
  sinal: "+" | "-" | "";
}

/** Colunas de rubrica da aba Histograma (entre o salário base e os totais da planilha). */
export function colunasXlsb(abas: Abas): ColunaXlsb[] {
  const h = abas.Histograma ?? [];
  const sinais = h[LINHA.sinal] ?? [];
  const codigos = h[LINHA.codigo] ?? [];
  const nomes = h[LINHA.nome] ?? [];
  const fim = fimDasRubricas(nomes);
  const cols: ColunaXlsb[] = [];
  for (let c = COL.salarioBase + 1; c < fim; c++) {
    const titulo = String(nomes[c] ?? "")
      .trim()
      .toUpperCase();
    const cod = codigos[c];
    const codigoPlanilha = typeof cod === "number" && Number.isInteger(cod) && cod > 0 ? cod : null;
    if (!titulo && codigoPlanilha === null) continue;
    const s = String(sinais[c] ?? "").trim();
    cols.push({
      col: c,
      codigoPlanilha,
      titulo,
      sinal: s === "+" ? "+" : s === "-" ? "-" : sinalPeloNome(titulo),
    });
  }
  return cols;
}

/** Resolvedor padrão: o código da planilha; sem código, só as colunas conhecidas do fim. */
export const resolverPadrao = (codigoPlanilha: number | null, titulo: string) =>
  codigoPlanilha ?? SEM_CODIGO.find(([re]) => re.test(normal(titulo)))?.[1] ?? null;

export function lerModeloXlsb(
  abas: Abas,
  arquivo: string,
  construtora: Construtora,
  rubricasDoIto: ReadonlySet<number>,
  /** (código da planilha, título) → código do ITO; null = coluna fica de fora */
  resolver: (codigoPlanilha: number | null, titulo: string) => number | null = resolverPadrao,
): PlanilhaHistorica {
  const avisos: Aviso[] = [];
  const h = abas.Histograma ?? [];
  const nomes = h[LINHA.nome] ?? [];
  conferirCabecalho(nomes, arquivo);
  const iProventos = (nomes as Celula[]).findIndex((v) => normal(v) === "proventos");
  const rub: { col: number; codigo: number; nome: string; sinal: "+" | "-" | "" }[] = [];
  for (const x of colunasXlsb(abas)) {
    const codigo = resolver(x.codigoPlanilha, x.titulo);
    if (codigo === null) continue;
    rub.push({ col: x.col, codigo, nome: x.titulo, sinal: x.sinal });
  }
  const novas = new Map<number, { codigo: number; descricao: string; sinal: "+" | "-" | "" }>();
  for (const r of rub)
    if (!rubricasDoIto.has(r.codigo) && !novas.has(r.codigo))
      novas.set(r.codigo, { codigo: r.codigo, descricao: r.nome, sinal: r.sinal });

  const linhas: LinhaHistorico[] = [];
  const proventosPlanilha = new Map<string, number>();
  const proventosLidos = new Map<string, number>();
  const primeiroMes = new Map<string, string>();
  let estimadas = 0;
  for (const l of h.slice(LINHA.dados)) {
    if (!l || typeof l[COL.matricula] !== "number") continue;
    const comp = competenciaDe(l[COL.competencia]);
    if (!comp) continue;
    const matricula = String(Math.round(l[COL.matricula] as number));
    const salarioBase = numero(l[COL.salarioBase]);
    const hora = salarioBase > 0 ? salarioBase / 220 : 0;
    const k = `${comp.ano}-${comp.mes}`;
    const rubricas: RubricaLida[] = [];
    let faltasHoras = 0;
    let normais = 0;
    let rescisao = false;
    for (const r of rub) {
      const valor = Math.abs(numero(l[r.col]));
      if (!valor) continue;
      const n = normal(r.nome);
      let referencia = 0;
      if (ehHe(n) && hora) {
        referencia = valor / (hora * (/50%/.test(n) ? 1.5 : 2));
        estimadas++;
      } else if (ehFalta(n) && hora) {
        referencia = valor / hora;
        faltasHoras += referencia;
      }
      if (ehHorasNormais(r.codigo, n)) normais += valor;
      if (ehRescisao(n)) rescisao = true;
      if (r.sinal === "+") proventosLidos.set(k, (proventosLidos.get(k) ?? 0) + valor);
      rubricas.push({
        codigo: r.codigo,
        descricao: r.nome,
        referencia: Math.round(referencia * 100) / 100,
        valor: Math.round(valor * 100) / 100,
      });
    }
    if (iProventos > 0)
      proventosPlanilha.set(k, (proventosPlanilha.get(k) ?? 0) + numero(l[iProventos]));
    // fração do mês: horas normais (e saldo de salário) sobre o salário base
    const frac = salarioBase > 0 ? Math.min(1, normais / salarioBase) : 1;
    const dias = frac >= 0.995 ? null : Math.max(0, Math.round(frac * diasNoMes(comp)));
    const chaveMat = `${matricula}|${construtora}`;
    const mesTxt = `${comp.ano}-${String(comp.mes).padStart(2, "0")}`;
    if (!primeiroMes.has(chaveMat) || primeiroMes.get(chaveMat)! > mesTxt)
      primeiroMes.set(chaveMat, mesTxt);
    linhas.push({
      comp,
      matricula,
      construtora,
      funcao: String(l[COL.funcao] ?? "")
        .trim()
        .toUpperCase(),
      dias,
      admitido: false,
      desligado: rescisao,
      licencaDias: 0,
      feriasDias: 0,
      faltasHoras: Math.round(faltasHoras * 100) / 100,
      realocada: false,
      vt: null,
      rubricas,
    });
  }
  // admitido: primeiro mês da matrícula nesta obra (a planilha não traz a data de admissão)
  for (const x of linhas) {
    const mesTxt = `${x.comp.ano}-${String(x.comp.mes).padStart(2, "0")}`;
    x.admitido = primeiroMes.get(`${x.matricula}|${x.construtora}`) === mesTxt;
  }
  if (estimadas)
    avisos.push({
      tipo: "estimado",
      texto: `horas de HE e de falta estimadas pelo valor e pelo salário-hora (${estimadas} lançamentos de HE)`,
    });
  avisos.push({
    tipo: "estimado",
    texto:
      "fração do mês estimada pelas horas normais sobre o salário base; admissão = primeiro mês na obra",
  });
  // conferência: proventos lidos × coluna "Proventos" da própria planilha
  for (const [k, v] of proventosPlanilha) {
    const lido = proventosLidos.get(k) ?? 0;
    if (Math.abs(lido - v) >= 1)
      avisos.push({
        tipo: "conferencia",
        texto: `proventos de ${k}: lidos ${moeda(lido)} × planilha ${moeda(v)}`,
      });
  }
  const adicionais = (abas.Adicionais ?? [])
    .slice(6)
    .reduce((s, l) => s + (l && typeof l[1] === "number" ? numero(l[9]) : 0), 0);
  if (adicionais > 0.5)
    avisos.push({
      tipo: "ignorado",
      texto: `aba Adicionais (fora da folha): ${moeda(adicionais)} não importados`,
    });

  const premissas = abas.Premissas ?? [];
  const titulo =
    premissas
      .slice(0, 5)
      .flatMap((l) => l ?? [])
      .find((v) => typeof v === "string" && /^obra\b/i.test(v.trim())) ?? "";
  const inicioCel = premissas
    .slice(4, 8)
    .map((l) => (l ?? []).find((v) => typeof v === "number" && v > 30000 && v < 80000))
    .find((v) => v !== undefined);

  return {
    arquivo,
    modelo: "xlsb",
    construtora,
    titulo: String(titulo).trim(),
    inicio: inicioCel === undefined ? null : competenciaDe(inicioCel),
    feriados: [],
    linhas,
    proventos: [...proventosPlanilha].map(([k, valor]) => {
      const [ano, mes] = k.split("-").map(Number);
      return { comp: { ano: ano!, mes: mes! }, valor: Math.round(valor * 100) / 100 };
    }),
    rubricasNovas: [...novas.values()].sort((a, b) => a.codigo - b.codigo),
    avisos,
  };
}
