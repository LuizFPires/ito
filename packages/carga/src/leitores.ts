/**
 * Leitores dos arquivos da carga (PLAN M4), no layout padrão do ITO (`layout.ts`) e XML de NF.
 * Saída só com matrícula: colunas que o layout não conhece (nome, CPF…) nunca são lidas.
 * Cada erro diz a aba, a linha e o que corrigir.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ABA_ERP, ABA_PESSOAS, ABA_PONTO, ABA_RESUMO, ABA_RUBRICAS, ABA_VT } from "./layout";
import type { Aba, Celula, Competencia, ErroLeitura, Planilha } from "./planilha";
import {
  acharAba,
  lerAba,
  lerCompetencia,
  lerMatricula,
  lerNumero,
  lerSimNao,
  lerTexto,
} from "./planilha";

/** Função como está na folha, no formato dos sinônimos (caixa alta, espaços simples). */
export const textoFuncao = (c: Celula) => lerTexto(c).toUpperCase().replace(/\s+/g, " ");

export interface LinhaRubrica {
  comp: Competencia;
  matricula: string;
  funcao: string;
  codigo: number;
  descricao: string;
  referencia: number;
  valor: number;
}

export interface LinhaPessoa {
  comp: Competencia;
  matricula: string;
  funcao: string;
  /** dias com vínculo; null = mês cheio */
  dias: number | null;
  admitido: boolean;
  desligado: boolean;
  faltasHoras: number;
  licencaDias: number;
  feriasDias: number;
  /** MDO realocada: obra onde trabalhou */
  obra: string | null;
}

export interface LeituraFolha {
  rubricas: LinhaRubrica[];
  pessoas: LinhaPessoa[];
  resumo: { comp: Competencia; proventos: number }[];
  erros: ErroLeitura[];
}

const chaveComp = (c: Competencia) => `${c.ano}-${String(c.mes).padStart(2, "0")}`;

/** Lê uma aba exigindo competência (e matrícula, se a aba tiver) em cada linha. */
function linhasValidas<K extends string>(
  p: Planilha,
  aba: Aba<K>,
  erros: ErroLeitura[],
  opcional: boolean,
  unica = false,
) {
  const linhas = acharAba(p, aba, unica);
  if (!linhas) {
    if (!opcional)
      erros.push({
        aba: aba.nome,
        linha: 0,
        mensagem: `Falta a aba ${aba.nome}. Use o modelo do ITO.`,
      });
    return [];
  }
  const r = lerAba(linhas, aba);
  erros.push(...r.erros);
  const temMat = aba.colunas.some((c) => c.chave === "matricula");
  const ok: { linha: number; comp: Competencia; matricula: string; c: Record<K, Celula> }[] = [];
  for (const { linha, c } of r.registros) {
    const cel = c as Record<string, Celula>;
    const comp = lerCompetencia(cel.competencia);
    const matricula = temMat ? lerMatricula(cel.matricula) : "";
    if (!comp)
      erros.push({
        aba: aba.nome,
        linha,
        mensagem: "Competência inválida: use mm/aaaa (03/2025).",
      });
    else if (matricula === null)
      erros.push({
        aba: aba.nome,
        linha,
        mensagem:
          "Matrícula inválida: use até 20 letras, números, ponto ou hífen, com ao menos um número (nunca o nome).",
      });
    else ok.push({ linha, comp, matricula, c });
  }
  return ok;
}

const numeroOuErro = (
  v: Celula,
  aba: string,
  linha: number,
  nome: string,
  erros: ErroLeitura[],
  vazio: number | null = 0,
): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return vazio;
  const n = lerNumero(v);
  if (n === null)
    erros.push({ aba, linha, mensagem: `${nome} inválido: informe um número (1.234,56).` });
  return n;
};

/** Folha no layout ITO: abas Rubricas (obrigatória), Pessoas e Resumo. Um .csv = só rubricas. */
export function lerFolha(p: Planilha): LeituraFolha {
  const erros: ErroLeitura[] = [];
  const unica = Object.keys(p).length === 1;

  const porChave = new Map<string, LinhaRubrica>();
  for (const { linha, comp, matricula, c } of linhasValidas(p, ABA_RUBRICAS, erros, false, unica)) {
    const a = ABA_RUBRICAS.nome;
    const funcao = textoFuncao(c.funcao);
    const codigo = lerNumero(c.codigo);
    const valor = numeroOuErro(c.valor, a, linha, "Valor", erros, null);
    const referencia = numeroOuErro(c.referencia, a, linha, "Referência", erros);
    if (!funcao) erros.push({ aba: a, linha, mensagem: "Informe a função da folha." });
    else if (codigo === null || !Number.isInteger(codigo) || codigo <= 0)
      erros.push({ aba: a, linha, mensagem: "Rubrica inválida: informe o código numérico." });
    else if (valor === null) {
      if (c.valor === null || c.valor === undefined || String(c.valor).trim() === "")
        erros.push({ aba: a, linha, mensagem: "Informe o valor da rubrica." });
    } else if (referencia !== null) {
      // a mesma rubrica repetida no mês (lançamentos complementares) é somada
      const k = `${chaveComp(comp)}|${matricula}|${funcao}|${codigo}`;
      const ja = porChave.get(k);
      if (ja) {
        ja.valor += valor;
        ja.referencia += referencia;
      } else
        porChave.set(k, {
          comp,
          matricula,
          funcao,
          codigo,
          descricao: lerTexto(c.descricao),
          referencia,
          valor,
        });
    }
  }

  const pessoas: LinhaPessoa[] = [];
  const vistas = new Set<string>();
  for (const { linha, comp, matricula, c } of unica
    ? []
    : linhasValidas(p, ABA_PESSOAS, erros, true)) {
    const a = ABA_PESSOAS.nome;
    const funcao = textoFuncao(c.funcao);
    const k = `${chaveComp(comp)}|${matricula}|${funcao}`;
    if (!funcao) {
      erros.push({ aba: a, linha, mensagem: "Informe a função da folha." });
      continue;
    }
    if (vistas.has(k)) {
      erros.push({ aba: a, linha, mensagem: "Matrícula repetida na mesma competência e função." });
      continue;
    }
    vistas.add(k);
    const dias = numeroOuErro(c.dias, a, linha, "Dias de vínculo", erros, null);
    if (dias !== null && (dias < 0 || dias > 31)) {
      erros.push({ aba: a, linha, mensagem: "Dias de vínculo entre 0 e 31." });
      continue;
    }
    const nz = (v: Celula, nome: string) =>
      Math.max(0, numeroOuErro(v, a, linha, nome, erros) ?? 0);
    const obra = lerTexto(c.obra);
    pessoas.push({
      comp,
      matricula,
      funcao,
      dias,
      admitido: lerSimNao(c.admitido),
      desligado: lerSimNao(c.desligado),
      faltasHoras: nz(c.faltas, "Faltas"),
      licencaDias: Math.min(31, nz(c.licenca, "Dias de licença")),
      feriasDias: Math.min(31, nz(c.ferias, "Dias de férias")),
      obra: obra || null,
    });
  }

  const resumo: { comp: Competencia; proventos: number }[] = [];
  for (const { linha, comp, c } of unica ? [] : linhasValidas(p, ABA_RESUMO, erros, true)) {
    const v = numeroOuErro(c.proventos, ABA_RESUMO.nome, linha, "Total de proventos", erros, null);
    if (v !== null) resumo.push({ comp, proventos: v });
  }

  return { rubricas: [...porChave.values()], pessoas, resumo, erros };
}

export interface LinhaPonto {
  comp: Competencia;
  matricula: string;
  he: number;
  faltas: number;
}

export function lerPonto(p: Planilha): { linhas: LinhaPonto[]; erros: ErroLeitura[] } {
  const erros: ErroLeitura[] = [];
  const linhas: LinhaPonto[] = [];
  for (const { linha, comp, matricula, c } of linhasValidas(p, ABA_PONTO, erros, false, true)) {
    const he = numeroOuErro(c.he, ABA_PONTO.nome, linha, "Horas extras", erros);
    const faltas = numeroOuErro(c.faltas, ABA_PONTO.nome, linha, "Faltas", erros);
    if (he !== null && faltas !== null) linhas.push({ comp, matricula, he, faltas });
  }
  return { linhas, erros };
}

export interface LinhaVt {
  comp: Competencia;
  matricula: string;
  valor: number;
}

export function lerVt(p: Planilha): { linhas: LinhaVt[]; erros: ErroLeitura[] } {
  const erros: ErroLeitura[] = [];
  const linhas: LinhaVt[] = [];
  for (const { linha, comp, matricula, c } of linhasValidas(p, ABA_VT, erros, false, true)) {
    const valor = numeroOuErro(c.valor, ABA_VT.nome, linha, "Valor", erros, null);
    if (valor !== null) linhas.push({ comp, matricula, valor });
  }
  return { linhas, erros };
}

export interface LinhaErp {
  comp: Competencia;
  conta: string;
  valor: number;
}

export function lerErp(p: Planilha): { linhas: LinhaErp[]; erros: ErroLeitura[] } {
  const erros: ErroLeitura[] = [];
  const porChave = new Map<string, LinhaErp>();
  for (const { linha, comp, c } of linhasValidas(p, ABA_ERP, erros, false, true)) {
    const conta = lerTexto(c.conta);
    const valor = numeroOuErro(c.valor, ABA_ERP.nome, linha, "Valor", erros, null);
    if (!conta) erros.push({ aba: ABA_ERP.nome, linha, mensagem: "Informe a conta." });
    else if (valor !== null) {
      const k = `${chaveComp(comp)}|${conta}`;
      const ja = porChave.get(k);
      if (ja) ja.valor += valor;
      else porChave.set(k, { comp, conta, valor });
    }
  }
  return { linhas: [...porChave.values()], erros };
}

// ── NF de prestador (XML) ────────────────────────────────────────────────────

export interface NotaFiscal {
  arquivo: string;
  numero: string;
  prestadorCnpj: string;
  /** null = o XML não traz a competência (bloqueia até alguém escolher o mês) */
  comp: Competencia | null;
  valor: number;
  iss: number;
  pis: number;
  cofins: number;
  inss: number;
  ir: number;
  csll: number;
}

type No = Record<string, unknown>;
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

/** Primeiro valor (em profundidade) de uma das tags. */
function buscar(no: unknown, tags: readonly string[]): string | null {
  if (no === null || typeof no !== "object") return null;
  if (Array.isArray(no)) {
    for (const x of no) {
      const r = buscar(x, tags);
      if (r !== null) return r;
    }
    return null;
  }
  for (const [k, v] of Object.entries(no as No))
    if (tags.includes(k) && (typeof v === "string" || typeof v === "number"))
      return String(v).trim();
  for (const v of Object.values(no as No)) {
    const r = buscar(v, tags);
    if (r !== null) return r;
  }
  return null;
}

/** Subárvores com uma das tags (lote com várias notas). */
function nos(no: unknown, tags: readonly string[], achados: unknown[] = []): unknown[] {
  if (no === null || typeof no !== "object") return achados;
  if (Array.isArray(no)) {
    for (const x of no) nos(x, tags, achados);
    return achados;
  }
  for (const [k, v] of Object.entries(no as No)) {
    if (tags.includes(k)) {
      if (Array.isArray(v)) achados.push(...v);
      else achados.push(v);
    } else nos(v, tags, achados);
  }
  return achados;
}

const valorXml = (no: unknown, tags: readonly string[]) => {
  const v = buscar(no, tags);
  const n = v === null ? 0 : Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * XML de NFS-e: padrão nacional (NFSe/infNFSe/DPS) e ABRASF (CompNfse/Nfse/InfNfse). Um arquivo
 * pode ter várias notas. Prestador pessoa física (CPF) não é guardado (regra 2).
 */
export function lerNotasFiscais(
  xml: string,
  arquivo: string,
): { notas: NotaFiscal[]; erros: ErroLeitura[] } {
  const erros: ErroLeitura[] = [];
  let doc: unknown;
  try {
    if (XMLValidator.validate(xml) !== true) throw new Error("xml");
    doc = parser.parse(xml);
  } catch {
    return {
      notas: [],
      erros: [
        { aba: arquivo, linha: 0, mensagem: "XML inválido: confira se é o arquivo da nota." },
      ],
    };
  }
  const lista = nos(doc, ["CompNfse", "NFSe"]);
  const notas: NotaFiscal[] = [];
  for (const n of lista.length ? lista : [doc]) {
    const numero = buscar(n, ["nNFSe", "Numero", "nDPS"]);
    const prest = nos(n, ["prest", "emit", "PrestadorServico", "Prestador"]);
    const cnpj = (buscar(prest.length ? prest : n, ["CNPJ", "Cnpj"]) ?? "").replace(/\D/g, "");
    if (!numero) {
      erros.push({ aba: arquivo, linha: 0, mensagem: "Nota sem número: confira o XML." });
      continue;
    }
    if (cnpj.length !== 14) {
      erros.push({
        aba: arquivo,
        linha: 0,
        mensagem: `NF ${numero}: prestador sem CNPJ (pessoa física não é guardada). Lance-a à parte.`,
      });
      continue;
    }
    const compTxt = buscar(n, ["dCompet", "Competencia"]);
    const m = compTxt ? /^(\d{4})-(\d{2})/.exec(compTxt) : null;
    notas.push({
      arquivo,
      numero,
      prestadorCnpj: cnpj,
      comp: m ? { ano: Number(m[1]), mes: Number(m[2]) } : null,
      valor: valorXml(n, ["vServ", "ValorServicos"]),
      iss: valorXml(n, ["vISSQN", "ValorIss"]),
      pis: valorXml(n, ["vPis", "ValorPis"]),
      cofins: valorXml(n, ["vCofins", "ValorCofins"]),
      inss: valorXml(n, ["vRetCP", "ValorInss"]),
      ir: valorXml(n, ["vRetIRRF", "ValorIr"]),
      csll: valorXml(n, ["vRetCSLL", "ValorCsll"]),
    });
  }
  return { notas, erros };
}
