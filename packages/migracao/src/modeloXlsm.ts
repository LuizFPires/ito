/**
 * Modelo .xlsm "Histograma de Mão de Obra" (2016–2020, versões v04 a v20): aba Folha com uma
 * linha por matrícula e competência e colunas com nome (salário, adicionais, HE por tipo, faltas,
 * VT…). As colunas mudam de posição entre versões: tudo é achado pelo nome do cabeçalho.
 * A coluna do nome da pessoa nunca é lida.
 */
import type { Competencia, Construtora } from "@ito/carga";
import type {
  Abas,
  Aviso,
  Celula,
  LinhaHistorico,
  PlanilhaHistorica,
  RubricaLida,
} from "./historico";
import { coluna, competenciaDe, dataIso, indiceColunas, normal, numero } from "./historico";

/** Rubricas que a migração cria para colunas sem código equivalente na folha. */
export const RUBRICAS_MIGRACAO = {
  9001: {
    nome: "MULTA FGTS / GRRF (MIGRAÇÃO)",
    tipo: "provento",
    componente: "resc",
    tipoHe: null,
  },
  9002: { nome: "DIÁRIAS (MIGRAÇÃO)", tipo: "provento", componente: "extras", tipoHe: null },
  9010: { nome: "HORAS EXTRAS 50% (MIGRAÇÃO)", tipo: "provento", componente: "he", tipoHe: "util" },
  9011: {
    nome: "HORAS EXTRAS PRÊMIO (MIGRAÇÃO)",
    tipo: "provento",
    componente: "he",
    tipoHe: "util",
  },
  9012: {
    nome: "HORAS EXTRAS OUTRAS (MIGRAÇÃO)",
    tipo: "provento",
    componente: "he",
    tipoHe: "util",
  },
} as const;

/** Grupo de HE da planilha → rubrica do ITO (horas na referência). */
function rubricaHe(grupo: string): { codigo: number; descricao: string } {
  if (grupo.includes("intervalo")) return { codigo: 205, descricao: "INTERVALO INTRAJORNADA" };
  if (grupo.includes('"a"')) return { codigo: 200, descricao: "HORAS EXTRAS 100%" };
  if (grupo.includes('"b"')) return { codigo: 201, descricao: "HORAS EXTRAS SÁBADO 100%" };
  if (grupo.includes("feriado")) return { codigo: 210, descricao: "HORAS EXTRAS FERIADO 100%" };
  if (grupo.includes("50%")) return { codigo: 9010, descricao: RUBRICAS_MIGRACAO[9010].nome };
  if (grupo.includes("premio")) return { codigo: 9011, descricao: RUBRICAS_MIGRACAO[9011].nome };
  return { codigo: 9012, descricao: RUBRICAS_MIGRACAO[9012].nome };
}

const temDigito = (v: Celula) => /\d/.test(String(v ?? ""));
const mesmoMes = (iso: string | null, ano: number, mes: number) =>
  !!iso && iso.slice(0, 7) === `${ano}-${String(mes).padStart(2, "0")}`;

export function lerModeloXlsm(
  abas: Abas,
  arquivo: string,
  construtora: Construtora,
): PlanilhaHistorica {
  const avisos: Aviso[] = [];
  const folha = abas.Folha ?? [];
  const premissas = abas.Premissas ?? [];
  // cabeçalho: linha 5 (grupos) e 6 (subtítulos); dados a partir da 8
  const cols = indiceColunas(folha[4] ?? [], folha[5] ?? []);
  const c = (...p: string[]) => coluna(cols, ...p);
  const iMat = c("cod. func", "cod.");
  const iFun = c("funcao");
  const iComp = c("competencia da folha");
  if (iMat === null || iFun === null || iComp === null)
    throw new Error(`${arquivo}: aba Folha sem matrícula, função ou competência no cabeçalho.`);
  const iReal = c("mdo realocada");
  const iClasse = c("classe");
  const iAdm = c("data de admissao");
  const iDem = c("data de demissao");
  const iLic = c("dias de licenca");
  const iFer = c("dias de ferias");
  const iDias = c("salario|referencia");
  const iSal = c("salario|salario base");
  const iFaltasH = c("faltas|faltas (horas)");
  const iVt = c("vale transporte|recarga");

  // colunas de valor → rubrica (código, descrição, coluna da referência)
  const valores: {
    col: number;
    codigo: number;
    descricao: string;
    ref: number | null;
    sinal: 1 | -1;
  }[] = [];
  const add = (
    col: number | null,
    codigo: number,
    descricao: string,
    ref: number | null = null,
    sinal: 1 | -1 = 1,
  ) => {
    if (col !== null) valores.push({ col, codigo, descricao, ref, sinal });
  };
  add(iSal, 1, "HORAS NORMAIS", iDias);
  add(c("premio r$"), 2126, "PRÊMIO");
  add(c("gratificacao"), 20, "GRATIFICAÇÕES");
  add(c("depreciacao"), 310, "DEPRECIAÇÃO DE FERRAMENTAS");
  add(c("adicional de transferencia"), 170, "ADICIONAL DE TRANSFERÊNCIA 25%");
  add(c("adicional de periculosidade"), 149, "PERICULOSIDADE 30%");
  add(c("adicional de insalubridade"), 155, "INSALUBRIDADE");
  add(c("adicional noturno|valor"), 160, "ADICIONAL NOTURNO", c("adicional noturno|qtde"));
  add(c("dsr sobre adicional noturno (t"), 161, "DSR S/ ADICIONAL NOTURNO");
  const gruposHe = [
    ...new Set(
      cols.filter((x) => x.nome.startsWith("horas extras")).map((x) => x.nome.split("|")[0]!),
    ),
  ];
  for (const g of gruposHe) {
    const v = coluna(cols, `${g}|valor`);
    if (v === null) continue;
    const r = rubricaHe(g);
    add(v, r.codigo, r.descricao, coluna(cols, `${g}|qtde`));
  }
  add(c("dsr sobre horas extras (t"), 250, "REFLEXO EXTRAS DSR");
  add(c("premio de producao|valor total"), 2127, "PRÊMIO DE PRODUÇÃO");
  add(c("faltas|desconto faltas"), 40, "HORAS FALTAS", iFaltasH);
  add(c("desconto repouso remunerado|desconto de faltas"), 42, "HORAS FALTAS DSR");
  add(c("multa fgts", "multa grrf"), 9001, RUBRICAS_MIGRACAO[9001].nome);
  add(c("bolsa estagio"), 300, "BOLSA ESTÁGIO");
  add(c("diarias"), 9002, RUBRICAS_MIGRACAO[9002].nome);
  add(c("desconto cesta"), 2005, "DESCONTO CESTA BÁSICA");
  add(c("vale transporte|desconto 6%"), 2003, "VALE TRANSPORTE 6%");

  const linhas: LinhaHistorico[] = [];
  let vazias = 0;
  const proventos = new Map<string, number>();
  for (const l of folha.slice(7)) {
    if (!l || !temDigito(l[iMat])) continue;
    const comp = competenciaDe(l[iComp]);
    if (!comp) continue;
    const funcao = String(l[iFun] ?? "").trim();
    const salario = iSal === null ? 0 : numero(l[iSal]);
    // linhas reservadas da planilha: sem função e sem salário
    if ((["", "0", "N/A"].includes(funcao.toUpperCase()) || !funcao) && !salario) {
      vazias++;
      continue;
    }
    const rubricas: RubricaLida[] = [];
    for (const v of valores) {
      const valor = Math.abs(numero(l[v.col]));
      if (!valor) continue;
      rubricas.push({
        codigo: v.codigo,
        descricao: v.descricao,
        referencia: v.ref === null ? 0 : Math.abs(numero(l[v.ref])),
        valor: Math.round(valor * 100) / 100,
      });
      if (v.codigo !== 40 && v.codigo !== 42 && v.codigo !== 2005 && v.codigo !== 2003) {
        const k = `${comp.ano}-${comp.mes}`;
        proventos.set(k, (proventos.get(k) ?? 0) + valor);
      }
    }
    const adm = iAdm === null ? null : dataIso(l[iAdm]);
    const dem = iDem === null ? null : dataIso(l[iDem]);
    const realocada = iReal !== null && ["x", "sim", "s"].includes(normal(l[iReal]));
    // dias vazios = não trabalhou na obra no mês (só recebeu algum valor): pessoa-mês zero,
    // como o histograma da própria planilha (aba Resultados)
    const dias = iDias === null ? null : numero(l[iDias]);
    linhas.push({
      comp,
      matricula: String(l[iMat]).trim(),
      construtora,
      funcao: funcao.toUpperCase(),
      classe:
        iClasse === null
          ? undefined
          : String(l[iClasse] ?? "")
              .trim()
              .toUpperCase(),
      dias,
      admitido: mesmoMes(adm, comp.ano, comp.mes),
      desligado: mesmoMes(dem, comp.ano, comp.mes),
      licencaDias: iLic === null ? 0 : numero(l[iLic]),
      feriasDias: iFer === null ? 0 : numero(l[iFer]),
      faltasHoras: iFaltasH === null ? 0 : numero(l[iFaltasH]),
      realocada,
      vt: iVt === null ? null : numero(l[iVt]) || null,
      rubricas,
    });
  }
  if (vazias)
    avisos.push({ tipo: "ignorado", texto: `${vazias} linhas sem função e sem salário (vazias)` });
  if (iFer === null)
    avisos.push({ tipo: "atencao", texto: "versão sem a coluna de dias de férias" });
  if (iReal === null)
    avisos.push({ tipo: "atencao", texto: "versão sem a coluna de MDO realocada" });

  // Premissas: título da obra, início e feriados (datas nas linhas 12 a 24)
  const titulo =
    premissas
      .slice(0, 4)
      .flatMap((l) => l ?? [])
      .find((v) => typeof v === "string" && /^obra\b/i.test(v.trim())) ?? "";
  const inicioCel = (premissas[3] ?? []).find(
    (v) => v instanceof Date || (typeof v === "number" && v > 20000),
  );
  const feriados: { data: string; nome: string }[] = [];
  for (const l of premissas.slice(11, 24))
    for (const v of l ?? []) {
      const d = v instanceof Date ? dataIso(v) : null;
      if (d && !feriados.some((f) => f.data === d))
        feriados.push({ data: d, nome: "Feriado (planilha)" });
    }

  return {
    arquivo,
    modelo: "xlsm",
    construtora,
    titulo: String(titulo).trim(),
    inicio: inicioCel === undefined ? null : competenciaDe(inicioCel),
    feriados,
    linhas,
    proventos: [...proventos].map(([k, valor]) => {
      const [ano, mes] = k.split("-").map(Number);
      return { comp: { ano: ano!, mes: mes! }, valor: Math.round(valor * 100) / 100 };
    }),
    rubricasNovas: [],
    histograma: histogramaDaPlanilha(abas.Resultados ?? []),
    avisos,
  };
}

/** Linha "TOTAL HISTOGRAMA" da aba Resultados: pessoa-mês por mês (cabeçalho "CLASSE / REF"). */
export function histogramaDaPlanilha(res: Abas[string]): { comp: Competencia; pm: number }[] {
  const iCab = res.findIndex((l) => normal(l?.[1]) === "classe / ref");
  const iTot = res.findIndex((l) => normal(l?.[1]) === "total histograma");
  if (iCab < 0 || iTot < 0) return [];
  const cab = res[iCab] ?? [];
  const tot = res[iTot] ?? [];
  const saida: { comp: Competencia; pm: number }[] = [];
  for (let c = 3; c < cab.length; c++) {
    const comp = competenciaDe(cab[c]);
    if (comp) saida.push({ comp, pm: numero(tot[c]) });
  }
  return saida;
}
