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
import { join, relative } from "node:path";
import readXlsxFile from "read-excel-file/node";
import type { Cadastro, DadosObra } from "@ito/carga";
import { mesAno, moeda, numero } from "@ito/formato";
import type { Contexto } from "@ito/motor";
import { anoMes, feriadosDaCidade, parametrosEpoca } from "@ito/motor";
import type { Api, Contexto9 } from "./banco";
import { carregarContexto, conectar, REPO } from "./banco";
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
import { montarTabelaRubricas, PRIMEIRO_CODIGO_MIGRACAO } from "./tabelaRubricas";
import { lerXlsb } from "./xlsb";

const DOCS = join(REPO, "docs", "migracao");

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
/** Só as linhas que uma pessoa revisou (coluna "revisado" = sim) mandam sobre as regras. */
const funcoesRevisadas = () =>
  new Map(
    lerTabela("funcoes.csv")
      .filter((l) => l.funcao && l.texto && l.revisado === "sim")
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
const COLUNAS_FUNCOES = ["texto", "funcao", "origem", "revisado", "matriculas", "obras"] as const;
const COLUNAS_RUBRICAS = [
  "codigo_planilha",
  "titulo",
  "codigo_ito",
  "nome",
  "tipo",
  "componente",
  "origem",
  "revisado",
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
    .filter((l) => l.revisado === "sim")
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

  // funções: linhas revisadas de funcoes.csv (revisado = sim) mandam sobre as regras
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
            ...c.cadastro.funcoes.find((x) => x.id === f.modelo)!,
            id,
            escalaArea: f.escalaArea,
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
        origem: x.origem,
        revisado: tabFuncoes.has(texto) ? "sim" : "",
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
      revisado: l.origem === "revisao" ? "sim" : "",
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

/**
 * Grava as obras prontas. Obra que já existe só é substituída se foi a própria migração (o mesmo
 * usuário) que a carregou; carga feita por outra pessoa pede `--substituir` (revisão M9).
 */
async function carregar(pasta: string, api: Api, usuario: string, forcar: boolean) {
  let c = await carregarContexto(api);
  let p = await preparar(pasta, c);
  // 1. funções e cidades novas que as obras usam
  for (const id of p.funcoesUsadas)
    if (!c.funcoesIds.has(id) && FUNCOES_NOVAS[id]) {
      const f = FUNCOES_NOVAS[id]!;
      await api.rpc("criar_funcao", {
        p_id: id,
        p_nome: f.nome,
        p_escala_area: f.escalaArea,
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
  const existentes = new Map(
    (
      await api.ler<{ id: string; carregada_por: string | null }>("obras?select=id,carregada_por")
    ).map((o) => [o.id, o.carregada_por]),
  );
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
    const existe = existentes.has(o.id);
    if (existe && existentes.get(o.id) !== usuario && !forcar) {
      resultado.set(o.id, "já existe, carregada por outra pessoa (use --substituir)");
      continue;
    }
    try {
      await api.rpc("gravar_carga", { p: { ...m.verificacao.payload, substituir: existe } });
      resultado.set(o.id, "carregada");
      console.log(`obra carregada: ${o.id}`);
    } catch (e) {
      resultado.set(
        o.id,
        `erro ao gravar: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
      );
    }
  }
  // 3. rubricas que a própria migração criou e saíram da tabela (colunas de total da planilha,
  // revisão M9): apaga as que não têm lançamento; a FK protege as que ainda têm
  const naTabela = new Set(p.tabelaRubricas.map((l) => l.codigo));
  for (const r of c.cadastro.rubricas)
    if (r.codigo >= PRIMEIRO_CODIGO_MIGRACAO && !naTabela.has(r.codigo))
      try {
        await api.apagar(`rubricas?codigo=eq.${r.codigo}`);
        console.log(`rubrica fora da tabela apagada: ${r.codigo}`);
      } catch {
        console.log(`rubrica ${r.codigo} fora da tabela ainda tem lançamentos; ficou`);
      }
  gravarTabelas(p, c);
  writeFileSync(join(DOCS, "relatorio.md"), relatorio(p, c, resultado), "utf8");
}

// ── entrada ─────────────────────────────────────────────────────────────────

async function main() {
  const [cmd, pasta, ...resto] = process.argv.slice(2);
  const args: Record<string, string> = {};
  for (let i = 0; i < resto.length; i++) {
    const nome = resto[i]!.replace(/^--/, "");
    const valor = resto[i + 1];
    if (valor === undefined || valor.startsWith("--")) args[nome] = "sim";
    else args[nome] = (i++, valor);
  }
  if (!cmd || !pasta || !["preparar", "carregar"].includes(cmd)) {
    console.log(
      "Uso: pnpm migrar preparar|carregar <pasta das planilhas> [--url URL --chave CHAVE] [--substituir]",
    );
    process.exit(1);
  }
  const { api, url, usuario } = await conectar(args);
  console.log(`banco: ${url}`);
  if (cmd === "preparar") {
    const c = await carregarContexto(api);
    const p = await preparar(pasta, c);
    gravarTabelas(p, c);
    writeFileSync(join(DOCS, "relatorio.md"), relatorio(p, c, new Map()), "utf8");
  } else await carregar(pasta, api, usuario, args.substituir === "sim");
  console.log(`tabelas e relatório em ${relative(process.cwd(), DOCS)}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
