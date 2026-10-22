/**
 * Migração do histórico (M9). Uso, na raiz do repositório:
 *
 *   pnpm migrar preparar <pasta das planilhas>
 *     lê as planilhas e gera, sem gravar no banco: docs/migracao/obras.csv (dados das obras para
 *     completar: área, cidade…), funcoes.csv e rubricas.csv (mapeamentos revisáveis) e
 *     relatorio.md (pendências por obra, sem dado pessoal);
 *
 *   pnpm migrar carregar <pasta das planilhas> [--url URL --chave CHAVE_PUBLICA]
 *     o mesmo e, depois, cria funções, cidades e rubricas novas e grava as obras com área
 *     (gravar_carga, substituindo as já migradas).
 *
 * Banco: por padrão o Supabase local (apps/web/.env.local). Login de quem migra: variáveis
 * ITO_MIGRACAO_EMAIL e ITO_MIGRACAO_SENHA (no local, o admin do seed). Os nomes das pessoas nunca
 * saem das planilhas: os conversores só leem matrícula, função e valores.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readXlsxFile from "read-excel-file/node";
import type { Cadastro, DadosObra, RubricaCadastro } from "@ito/carga";
import { mesAno, moeda, numero } from "@ito/formato";
import type { Contexto, Tabela } from "@ito/motor";
import { anoMes, feriadosDaCidade, parametrosEpoca } from "@ito/motor";
import { contextoDoBanco, tabelaDoBanco } from "../../../apps/web/src/lib/motorDoBanco";
import type { LinhaCsv } from "./csv";
import { escreverCsv, lerCsv, numeroBr } from "./csv";
import { FUNCOES_NOVAS, funcaoDoHistorico } from "./funcoes";
import type { Abas, PlanilhaHistorica } from "./historico";
import { colunasXlsb, lerModeloXlsb } from "./modeloXlsb";
import { lerModeloXlsm, RUBRICAS_MIGRACAO } from "./modeloXlsm";
import type { MontagemObra } from "./montar";
import { montarObra, rubricasNovasDe } from "./montar";
import type { ArquivoLido, ObraHistorica } from "./obras";
import { agruparObras, CIDADES_NOVAS, construtoraDe, periodo, sugestaoDaObra } from "./obras";
import type { LinhaTabela, Ocorrencia } from "./tabelaRubricas";
import { montarTabelaRubricas } from "./tabelaRubricas";
import { lerXlsb } from "./xlsb";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DOCS = join(REPO, "docs", "migracao");

// ── banco (API REST do Supabase) ────────────────────────────────────────────

interface Api {
  ler<R>(caminho: string): Promise<R[]>;
  rpc<R>(nome: string, corpo: unknown): Promise<R>;
  inserir(tabela: string, corpo: unknown): Promise<void>;
}

function envLocal(): Record<string, string> {
  try {
    const txt = readFileSync(join(REPO, "apps/web/.env.local"), "utf8");
    return Object.fromEntries(
      txt
        .split(/\r?\n/)
        .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1]!, m[2]!]),
    );
  } catch {
    return {};
  }
}

async function conectar(args: Record<string, string>): Promise<{ api: Api; url: string }> {
  const env = envLocal();
  const url = args.url ?? env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54821";
  const chave = args.chave ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const local = /127\.0\.0\.1|localhost/.test(url);
  const email = process.env.ITO_MIGRACAO_EMAIL ?? (local ? "admin@ito.local" : "");
  const senha = process.env.ITO_MIGRACAO_SENHA ?? (local ? "ito-dev-2026" : "");
  if (!email || !senha)
    throw new Error("Informe ITO_MIGRACAO_EMAIL e ITO_MIGRACAO_SENHA (controladoria ou admin).");
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!r.ok) throw new Error(`Login recusado (${r.status}). Confira e-mail, senha e a URL.`);
  const { access_token } = (await r.json()) as { access_token: string };
  const cab = {
    apikey: chave,
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };
  const falha = async (r: Response, o: string) => {
    if (!r.ok) throw new Error(`${o}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  };
  return {
    url,
    api: {
      async ler<R>(caminho: string) {
        const todas: R[] = [];
        for (let de = 0; ; de += 1000) {
          const r = await fetch(
            `${url}/rest/v1/${caminho}${caminho.includes("?") ? "&" : "?"}limit=1000&offset=${de}`,
            { headers: cab },
          );
          await falha(r, `GET ${caminho}`);
          const lote = (await r.json()) as R[];
          todas.push(...lote);
          if (lote.length < 1000) return todas;
        }
      },
      async rpc<R>(nome: string, corpo: unknown) {
        const r = await fetch(`${url}/rest/v1/rpc/${nome}`, {
          method: "POST",
          headers: cab,
          body: JSON.stringify(corpo),
        });
        await falha(r, `rpc ${nome}`);
        const t = await r.text();
        return (t ? JSON.parse(t) : null) as R;
      },
      async inserir(tabela: string, corpo: unknown) {
        const r = await fetch(`${url}/rest/v1/${tabela}`, {
          method: "POST",
          headers: cab,
          body: JSON.stringify(corpo),
        });
        await falha(r, `POST ${tabela}`);
      },
    },
  };
}

interface Contexto9 {
  cadastro: Cadastro;
  ctx: Contexto;
  tabelas: Record<number, Tabela>;
  vigente: number;
  datasBase: number[];
  cidades: {
    id: string;
    nome: string;
    uf: string;
    feriados: { dia: number; mes: number; nome: string }[];
  }[];
  funcoesIds: Set<string>;
  sinonimos: Map<string, string>;
}

async function carregarContexto(api: Api): Promise<Contexto9> {
  /* eslint-disable @typescript-eslint/no-explicit-any -- linhas do PostgREST, tipadas no app */
  const [
    funcoes,
    sinonimos,
    rubricas,
    beneficios,
    [parametros],
    feriadosEmpresa,
    datas,
    salarios,
    valoresBen,
    encargos,
    cidades,
    ferCid,
  ] = await Promise.all([
    api.ler<any>("funcoes?select=*&order=id"),
    api.ler<any>("funcao_sinonimos?select=*&order=texto"),
    api.ler<any>("rubricas?select=*&order=codigo"),
    api.ler<any>("beneficios?select=*&order=id"),
    api.ler<any>("parametros?select=*"),
    api.ler<any>("feriados_empresa?select=*&order=data"),
    api.ler<any>("datas_base?select=*&order=ano"),
    api.ler<any>("data_base_salarios?select=*&order=ano,funcao_id"),
    api.ler<any>("data_base_beneficios?select=*&order=ano,beneficio_id"),
    api.ler<any>("data_base_encargos?select=*&order=ano,id"),
    api.ler<any>("cidades?select=id,nome,uf&order=id"),
    api.ler<any>("cidade_feriados?select=*&order=cidade_id,mes,dia"),
  ]);
  const tabelas: Record<number, Tabela> = {};
  for (const d of datas)
    tabelas[d.ano] = tabelaDoBanco(
      d,
      Object.fromEntries(
        salarios
          .filter((s: any) => s.ano === d.ano)
          .map((s: any) => [s.funcao_id, Number(s.valor)]),
      ),
      Object.fromEntries(
        valoresBen
          .filter((b: any) => b.ano === d.ano)
          .map((b: any) => [b.beneficio_id, Number(b.valor)]),
      ),
      encargos.filter((e: any) => e.ano === d.ano),
    );
  const cadRubricas: RubricaCadastro[] = rubricas.map((r: any) => ({
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo,
    componente: r.componente,
    baseProvisoes: r.base_provisoes,
    tipoHe: r.tipo_he ?? null,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    cadastro: {
      funcoes: contextoDoBanco(funcoes, [], parametros, []).funcoes,
      nomesFuncoes: Object.fromEntries(
        funcoes.map((f: { id: string; nome: string }) => [f.id, f.nome]),
      ),
      sinonimos: Object.fromEntries(
        sinonimos.map((s: { texto: string; funcao_id: string }) => [s.texto, s.funcao_id]),
      ),
      rubricas: cadRubricas,
    },
    ctx: contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa),
    tabelas,
    vigente: parametros.data_base_vigente ?? Math.max(...datas.map((d: { ano: number }) => d.ano)),
    datasBase: datas.map((d: { ano: number }) => d.ano),
    cidades: cidades.map((c: { id: string; nome: string; uf: string }) => ({
      ...c,
      feriados: ferCid
        .filter((f: { cidade_id: string }) => f.cidade_id === c.id)
        .map((f: { dia: number; mes: number; nome: string }) => ({
          dia: f.dia,
          mes: f.mes,
          nome: f.nome,
        })),
    })),
    funcoesIds: new Set(funcoes.map((f: { id: string }) => f.id)),
    sinonimos: new Map(
      sinonimos.map((s: { texto: string; funcao_id: string }) => [s.texto, s.funcao_id]),
    ),
  };
}

// ── leitura das planilhas ───────────────────────────────────────────────────

interface Bruto {
  caminho: string;
  modificado: number;
  modelo: "xlsm" | "xlsb";
  abas: Abas;
}

async function lerPasta(pasta: string): Promise<Bruto[]> {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(xlsm|xlsb)$/i.test(n)) arquivos.push(p);
    }
  };
  andar(pasta);
  const brutos: Bruto[] = [];
  for (const f of arquivos.sort()) {
    const caminho = relative(pasta, f).replaceAll("\\", "/");
    const modificado = statSync(f).mtimeMs;
    if (/\.xlsb$/i.test(f))
      brutos.push({
        caminho,
        modificado,
        modelo: "xlsb",
        abas: lerXlsb(new Uint8Array(readFileSync(f))),
      });
    else {
      const abas = (await readXlsxFile(f)) as unknown as { sheet: string; data: unknown[][] }[];
      brutos.push({
        caminho,
        modificado,
        modelo: "xlsm",
        abas: Object.fromEntries(abas.map((a) => [a.sheet, a.data])) as Abas,
      });
    }
  }
  return brutos;
}

// ── tabelas revisáveis (docs/migracao) ──────────────────────────────────────

const lerTabela = (nome: string): LinhaCsv[] =>
  existsSync(join(DOCS, nome)) ? lerCsv(readFileSync(join(DOCS, nome), "utf8")) : [];
const gravarTabela = (nome: string, colunas: readonly string[], linhas: readonly LinhaCsv[]) => {
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, nome), escreverCsv(colunas, linhas), "utf8");
};

/** texto da planilha → função do ITO revisada em funcoes.csv */
const funcoesRevisadas = () =>
  new Map(
    lerTabela("funcoes.csv")
      .filter((l) => l.funcao && l.texto)
      .map((l) => [l.texto!, l.funcao!] as const),
  );

const COLUNAS_OBRAS = [
  "id",
  "nome",
  "cliente",
  "tipologia",
  "cidade",
  "area_m2",
  "data_base",
  "inicio",
  "meses",
  "construtoras",
  "arquivos",
  "observacao",
] as const;
const COLUNAS_FUNCOES = ["texto", "funcao", "origem", "matriculas", "obras"] as const;
const COLUNAS_RUBRICAS = [
  "codigo_planilha",
  "titulo",
  "codigo_ito",
  "nome",
  "tipo",
  "componente",
  "origem",
] as const;

// ── preparar ────────────────────────────────────────────────────────────────

interface Preparo {
  obras: ObraHistorica[];
  linhasObras: LinhaCsv[];
  montagens: Map<string, MontagemObra>;
  pendencias: Map<string, string[]>;
  tabelaRubricas: LinhaTabela[];
  funcoesUsadas: Set<string>;
  cidadesUsadas: Set<string>;
}

function resolverCidade(valor: string, c: Contexto9): { id: string | null; nova: boolean } {
  const v = valor.trim();
  if (!v) return { id: null, nova: false };
  if (c.cidades.some((x) => x.id === v)) return { id: v, nova: false };
  if (CIDADES_NOVAS[v]) return { id: v, nova: true };
  const [nome, uf] = v.split("/").map((x) => x.trim().toLowerCase());
  const achou = c.cidades.find(
    (x) => x.nome.toLowerCase() === nome && (!uf || x.uf.toLowerCase() === uf),
  );
  if (achou) return { id: achou.id, nova: false };
  const nova = Object.entries(CIDADES_NOVAS).find(([, x]) => x.nome.toLowerCase() === nome);
  return nova ? { id: nova[0], nova: true } : { id: null, nova: false };
}

async function preparar(pasta: string, c: Contexto9): Promise<Preparo> {
  const brutos = await lerPasta(pasta);
  // rubricas: tabela por (código, título) sobre todas as planilhas .xlsb, com a revisão gravada
  const ocorrencias: Ocorrencia[] = brutos
    .filter((b) => b.modelo === "xlsb")
    .flatMap((b) =>
      colunasXlsb(b.abas).map((x) => ({
        codigoPlanilha: x.codigoPlanilha,
        titulo: x.titulo,
        sinal: x.sinal,
      })),
    );
  const dicionario = [...c.cadastro.rubricas.map((r) => ({ codigo: r.codigo, nome: r.nome }))];
  const revisao = lerTabela("rubricas.csv")
    .filter((l) => l.origem === "revisao" || l.revisado === "sim")
    .map((l) => ({
      codigoPlanilha: numeroBr(l.codigo_planilha),
      titulo: l.titulo ?? "",
      codigo: Number(l.codigo_ito),
      nome: l.nome,
    }));
  const tabela = montarTabelaRubricas(ocorrencias, dicionario, revisao);
  // rubricas do .xlsm sem código na folha (multa FGTS, diárias, HE 50%…)
  const linhasXlsm: LinhaTabela[] = Object.entries(RUBRICAS_MIGRACAO)
    .filter(([cod]) => !c.cadastro.rubricas.some((r) => r.codigo === Number(cod)))
    .map(([cod, r]) => ({
      codigoPlanilha: null,
      titulo: r.nome,
      codigo: Number(cod),
      nome: r.nome,
      origem: "migracao" as const,
      nova: {
        tipo: r.tipo,
        componente: r.componente,
        tipoHe: r.tipoHe,
        baseProvisoes: r.componente !== "resc",
      },
    }));
  const tabelaRubricas = [...tabela.linhas, ...linhasXlsm];
  const rubricasNovas = rubricasNovasDe(tabelaRubricas);
  const codigosIto = new Set(c.cadastro.rubricas.map((r) => r.codigo));

  const lidos: ArquivoLido[] = brutos.map((b) => {
    const construtora = construtoraDe(b.caminho);
    const planilha: PlanilhaHistorica =
      b.modelo === "xlsb"
        ? lerModeloXlsb(b.abas, b.caminho, construtora, codigosIto, tabela.resolver)
        : lerModeloXlsm(b.abas, b.caminho, construtora);
    return { caminho: b.caminho, modificado: b.modificado, planilha };
  });
  const obras = agruparObras(lidos);

  // funções: tabela revisada (coluna "funcao" de funcoes.csv) manda sobre as regras
  const tabFuncoes = funcoesRevisadas();
  const funcaoDe = (texto: string, classe: string) =>
    funcaoDoHistorico(texto, classe, tabFuncoes, c.sinonimos).id;

  const anteriores = new Map(lerTabela("obras.csv").map((l) => [l.id, l]));
  const linhasObras: LinhaCsv[] = [];
  const montagens = new Map<string, MontagemObra>();
  const pendencias = new Map<string, string[]>();
  const funcoesUsadas = new Set<string>();
  const cidadesUsadas = new Set<string>();
  const minBase = Math.min(...c.datasBase);
  for (const o of obras) {
    const sug = sugestaoDaObra(o);
    const per = periodo(o);
    const ant = anteriores.get(o.id);
    const pend: string[] = [];
    const inicioTxt = per ? mesAno(per.inicio.ano, per.inicio.mes) : "";
    const anoInicio = per?.inicio.ano ?? minBase;
    const baseSugerida = c.datasBase.includes(anoInicio) ? anoInicio : minBase;
    const linha: LinhaCsv = {
      id: o.id,
      nome: ant?.nome || sug.nome,
      cliente: ant?.cliente ?? sug.cliente,
      tipologia: ant?.tipologia || sug.tipologia,
      cidade: ant?.cidade ?? sug.cidade,
      area_m2: ant?.area_m2 ?? "",
      data_base: ant?.data_base || String(baseSugerida),
      inicio: inicioTxt,
      meses: per ? String(per.meses) : "",
      construtoras: [...new Set(o.planilhas.map((a) => a.planilha.construtora))].join(" + "),
      arquivos: o.planilhas.map((a) => a.caminho).join(" | "),
      observacao: [
        ant?.cidade || sug.cidade ? "" : "cidade a confirmar",
        c.datasBase.includes(anoInicio)
          ? ""
          : `sem tabela da empresa de ${anoInicio}: época na de ${baseSugerida}`,
      ]
        .filter(Boolean)
        .join("; "),
    };
    linhasObras.push(linha);
    if (!per) {
      pend.push("sem lançamentos nas planilhas");
      pendencias.set(o.id, pend);
      continue;
    }
    const area = numeroBr(linha.area_m2);
    if (!area || area <= 0) pend.push("aguardando área (m²) em obras.csv");
    const cidade = resolverCidade(linha.cidade ?? "", c);
    if ((linha.cidade ?? "").trim() && !cidade.id)
      pend.push(`cidade "${linha.cidade}" não encontrada`);
    if (!cidade.id) pend.push("sem cidade (obra entra com a tabela da empresa)");
    if (cidade.id && cidade.nova) cidadesUsadas.add(cidade.id);
    const dataBase = Number(linha.data_base) || baseSugerida;
    if (!c.tabelas[dataBase]) pend.push(`data-base ${linha.data_base} não existe`);
    // feriados: os da planilha e os da cidade (cada ano do período)
    const anos = new Set<number>();
    for (let i = 0; i < per.meses; i++) anos.add(anoMes(per.inicio, i).ano);
    const ferCidade = c.cidades.find((x) => x.id === cidade.id)?.feriados ?? [];
    const feriados = [
      ...o.planilhas.flatMap((a) => a.planilha.feriados),
      ...[...anos].flatMap((a) => feriadosDaCidade(ferCidade, a)),
    ].filter((f, i, xs) => xs.findIndex((y) => y.data === f.data) === i);
    const dados: DadosObra = {
      id: o.id,
      nome: linha.nome!,
      cliente: linha.cliente ?? "",
      tipologia: linha.tipologia ?? "",
      cidadeId: cidade.id && !cidade.nova ? cidade.id : null,
      area: area ?? 1,
      inicio: per.inicio,
      meses: per.meses,
      dataBase,
      trocas: [],
      feriados,
      premissas: {},
      regime: {},
    };
    const parametros = parametrosEpoca(c.tabelas, dataBase, [], c.vigente);
    // funções novas ainda não existem no cadastro: entram no contexto como a função mais parecida
    const funcaoParaMontar = (texto: string, classe: string) => {
      const id = funcaoDe(texto, classe);
      funcoesUsadas.add(id);
      return id;
    };
    const cadastro: Cadastro = {
      ...c.cadastro,
      funcoes: [
        ...c.cadastro.funcoes,
        ...Object.entries(FUNCOES_NOVAS)
          .filter(([id]) => !c.funcoesIds.has(id))
          .map(([id, f]) => ({
            ...c.cadastro.funcoes.find(
              (x) =>
                x.id === (f.grupo === "direta" ? "ped" : f.grupo === "adm" ? "admin" : "encar"),
            )!,
            id,
            grupo: f.grupo,
            escalaArea: f.grupo === "direta",
          })),
      ],
    };
    const ctx: Contexto = { ...c.ctx, funcoes: cadastro.funcoes };
    try {
      montagens.set(
        o.id,
        montarObra(o, dados, cadastro, ctx, parametros, funcaoParaMontar, rubricasNovas),
      );
    } catch (e) {
      pend.push(`a montagem falhou: ${e instanceof Error ? e.message : String(e)}`);
    }
    pendencias.set(o.id, pend);
  }
  return {
    obras,
    linhasObras,
    montagens,
    pendencias,
    tabelaRubricas,
    funcoesUsadas,
    cidadesUsadas,
  };
}

function gravarTabelas(p: Preparo, c: Contexto9) {
  gravarTabela("obras.csv", COLUNAS_OBRAS, p.linhasObras);
  const funcoes = new Map<
    string,
    { funcao: string; origem: string; matriculas: number; obras: Set<string> }
  >();
  const tabFuncoes = funcoesRevisadas();
  for (const [id, m] of p.montagens)
    for (const f of m.funcoes) {
      const x = funcoes.get(f.texto) ?? {
        funcao: f.funcao,
        origem: funcaoDoHistorico(f.texto, "", tabFuncoes, c.sinonimos).origem,
        matriculas: 0,
        obras: new Set<string>(),
      };
      x.matriculas += f.matriculas;
      x.obras.add(id);
      funcoes.set(f.texto, x);
    }
  gravarTabela(
    "funcoes.csv",
    COLUNAS_FUNCOES,
    [...funcoes]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([texto, x]) => ({
        texto,
        funcao: x.funcao,
        origem: tabFuncoes.has(texto) ? "revisao" : x.origem,
        matriculas: String(x.matriculas),
        obras: [...x.obras].join(" "),
      })),
  );
  gravarTabela(
    "rubricas.csv",
    COLUNAS_RUBRICAS,
    p.tabelaRubricas.map((l) => ({
      codigo_planilha: l.codigoPlanilha === null ? "" : String(l.codigoPlanilha),
      titulo: l.titulo,
      codigo_ito: String(l.codigo),
      nome: l.nome,
      tipo: l.nova?.tipo ?? "",
      componente: l.nova?.componente ?? "",
      origem: l.origem,
    })),
  );
}

// ── relatório (sem dado pessoal: contagens, funções, rubricas e totais) ──────

function relatorio(p: Preparo, c: Contexto9, resultado: Map<string, string>): string {
  const L: string[] = [];
  const hoje = new Date().toLocaleDateString("pt-BR");
  L.push(
    "# Migração do histórico — relatório",
    "",
    `Gerado em ${hoje}. Sem dado pessoal: só contagens, funções, rubricas e totais.`,
    "",
  );
  const carregadas = [...resultado.values()].filter((v) => v.startsWith("carregada")).length;
  L.push(
    `- Obras: ${numero(p.obras.length)} (${numero(carregadas)} carregadas nesta execução)`,
    `- Planilhas usadas: ${numero(p.obras.reduce((s, o) => s + o.planilhas.length, 0))}; deixadas de lado: ${numero(p.obras.reduce((s, o) => s + o.descartadas.length, 0))}`,
    `- Funções novas usadas: ${
      [...p.funcoesUsadas]
        .filter((f) => !c.funcoesIds.has(f))
        .map((f) => FUNCOES_NOVAS[f]?.nome ?? f)
        .join(", ") || "nenhuma"
    }`,
    `- Cidades novas: ${[...p.cidadesUsadas].map((x) => CIDADES_NOVAS[x]!.nome).join(", ") || "nenhuma"}`,
    `- Rubricas novas: ${numero(p.tabelaRubricas.filter((l) => l.nova).length)} (classificação sugerida em rubricas.csv, para o DP/RH revisar)`,
    "",
  );
  for (const o of p.obras) {
    const linha = p.linhasObras.find((l) => l.id === o.id)!;
    const m = p.montagens.get(o.id);
    const pend = p.pendencias.get(o.id) ?? [];
    L.push(`## ${linha.nome} (\`${o.id}\`)`, "");
    L.push(
      `- Situação: **${resultado.get(o.id) ?? (pend.length ? "pendente" : "pronta para carregar")}**`,
    );
    L.push(
      `- Período: ${linha.inicio} · ${linha.meses} meses · construtoras: ${linha.construtoras}`,
    );
    L.push(`- Planilhas: ${o.planilhas.map((a) => `\`${a.caminho}\``).join(", ")}`);
    for (const d of o.descartadas) L.push(`- Deixada de lado: \`${d.caminho}\` (${d.motivo})`);
    if (m) {
      const lanc = m.montagem.payload.lancamentos;
      const mats = new Set(lanc.map((l) => `${l.matricula}|${l.construtora}`)).size;
      const pm = lanc.reduce((s, l) => s + l.equivalente, 0);
      L.push(
        `- ${numero(mats)} matrículas · ${numero(lanc.length)} lançamentos · ${numero(pm, 1)} pessoa-mês`,
      );
      // efetivo do ITO × histograma da própria planilha (aba Resultados do .xlsm)
      const hist = new Map<string, number>();
      for (const a of o.planilhas)
        for (const x of a.planilha.histograma ?? [])
          hist.set(
            `${x.comp.ano}-${x.comp.mes}`,
            (hist.get(`${x.comp.ano}-${x.comp.mes}`) ?? 0) + x.pm,
          );
      if (hist.size) {
        const ob = m.montagem.obra;
        const difs: string[] = [];
        let totIto = 0;
        let totPl = 0;
        for (let i = 0; i < ob.meses!; i++) {
          const { ano, mes } = anoMes(ob.inicio, i);
          const ito = Object.values(ob.equivalente).reduce((s, v) => s + (v[i] ?? 0), 0);
          const pl = hist.get(`${ano}-${mes}`) ?? 0;
          totIto += ito;
          totPl += pl;
          if (Math.abs(ito - pl) >= 0.05)
            difs.push(`${mesAno(ano, mes)} ${numero(ito, 1)} × ${numero(pl, 1)}`);
        }
        L.push(
          difs.length
            ? `- Efetivo × histograma da planilha: ${numero(totIto, 1)} × ${numero(totPl, 1)} pessoa-mês; difere em ${difs.join("; ")}`
            : `- Efetivo × histograma da planilha: confere (${numero(totIto, 1)} pessoa-mês)`,
        );
      }
      const porFuncao = m.funcoes.map(
        (f) =>
          `${f.texto} → ${c.cadastro.nomesFuncoes[f.funcao] ?? FUNCOES_NOVAS[f.funcao]?.nome ?? f.funcao}`,
      );
      L.push(`- Funções: ${porFuncao.join("; ")}`);
      const itens = m.verificacao.itens.filter((x) => x.estado !== "ok");
      if (itens.length)
        L.push(
          `- Verificações da carga: ${itens.map((x) => `${x.estado === "erro" ? "⚠️" : "ℹ️"} ${x.titulo}`).join("; ")}`,
        );
      const conf = m.verificacao.conferencia;
      if (conf.length) {
        const dif = conf.reduce((s, x) => s + Math.abs(x.diferenca), 0);
        L.push(
          `- Conferência rubricas × custo do ITO: diferença total ${moeda(dif)} em ${numero(conf.length)} meses`,
        );
      }
    }
    const avisos = o.planilhas.flatMap((a) =>
      a.planilha.avisos.map((x) => `${a.caminho.split("/").pop()}: ${x.texto}`),
    );
    for (const a of avisos) L.push(`- ${a}`);
    for (const p2 of pend) L.push(`- Pendência: ${p2}`);
    if (linha.observacao) L.push(`- Observação: ${linha.observacao}`);
    L.push("");
  }
  return L.join("\n");
}

// ── carregar ────────────────────────────────────────────────────────────────

async function carregar(pasta: string, api: Api) {
  let c = await carregarContexto(api);
  let p = await preparar(pasta, c);
  // 1. funções e cidades novas que as obras usam
  for (const id of p.funcoesUsadas)
    if (!c.funcoesIds.has(id) && FUNCOES_NOVAS[id]) {
      const f = FUNCOES_NOVAS[id]!;
      await api.rpc("criar_funcao", {
        p_id: id,
        p_nome: f.nome,
        p_grupo: f.grupo,
        p_sinonimo: null,
      });
      console.log(`função criada: ${f.nome}`);
    }
  for (const id of p.cidadesUsadas)
    if (!c.cidades.some((x) => x.id === id)) {
      const x = CIDADES_NOVAS[id]!;
      await api.inserir("cidades", { id, nome: x.nome, uf: x.uf, cct_id: x.cct });
      console.log(`cidade criada: ${x.nome}/${x.uf} (CCT ${x.cct})`);
    }
  // 2. de novo, com o cadastro atualizado
  c = await carregarContexto(api);
  p = await preparar(pasta, c);
  const resultado = new Map<string, string>();
  for (const o of p.obras) {
    const m = p.montagens.get(o.id);
    const pend = (p.pendencias.get(o.id) ?? []).filter((x) => !x.startsWith("sem cidade"));
    if (!m || pend.length) {
      resultado.set(
        o.id,
        pend.some((x) => x.startsWith("aguardando área")) ? "aguardando área" : "pendente",
      );
      continue;
    }
    try {
      await api.rpc("gravar_carga", { p: { ...m.verificacao.payload, substituir: true } });
      resultado.set(o.id, "carregada");
      console.log(`obra carregada: ${o.id}`);
    } catch (e) {
      resultado.set(
        o.id,
        `erro ao gravar: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
      );
    }
  }
  gravarTabelas(p, c);
  writeFileSync(join(DOCS, "relatorio.md"), relatorio(p, c, resultado), "utf8");
}

// ── entrada ─────────────────────────────────────────────────────────────────

async function main() {
  const [cmd, pasta, ...resto] = process.argv.slice(2);
  const args: Record<string, string> = {};
  for (let i = 0; i < resto.length; i += 2) args[resto[i]!.replace(/^--/, "")] = resto[i + 1] ?? "";
  if (!cmd || !pasta || !["preparar", "carregar"].includes(cmd)) {
    console.log(
      "Uso: pnpm migrar preparar|carregar <pasta das planilhas> [--url URL --chave CHAVE]",
    );
    process.exit(1);
  }
  const { api, url } = await conectar(args);
  console.log(`banco: ${url}`);
  if (cmd === "preparar") {
    const c = await carregarContexto(api);
    const p = await preparar(pasta, c);
    gravarTabelas(p, c);
    writeFileSync(join(DOCS, "relatorio.md"), relatorio(p, c, new Map()), "utf8");
  } else await carregar(pasta, api);
  console.log(`tabelas e relatório em ${relative(process.cwd(), DOCS)}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
