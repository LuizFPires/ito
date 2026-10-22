/**
 * Dados sintéticos para o teste de desempenho (M10, PRD §5): 1.000 obras, 100 CCTs e 500 cidades
 * no Supabase LOCAL, só com matrículas fictícias. Uso, na raiz do repositório:
 *
 *   pnpm desempenho gerar     cria o que faltar até as metas (ids com prefixo perf_)
 *   pnpm desempenho limpar    apaga tudo o que tem o prefixo perf_
 *
 * Grava pelo mesmo caminho da carga (montarCarga → gravar_carga) e deixa o resumo de cada obra
 * calculado pelo motor (gravar_resumos), como fica a base depois que alguém a abre.
 */
import type { CargaParaGravar, LinhaPessoa, LinhaRubrica } from "@ito/carga";
import { ESCOLHAS_VAZIAS, montarCarga } from "@ito/carga";
import { parametrosEpoca } from "@ito/motor";
import type { ObraBanco } from "../../../apps/web/src/lib/obraDoBanco";
import { impressaoContexto, resumoDaObra } from "../../../apps/web/src/lib/obraDoBanco";
import type { Api } from "./banco";
import { carregarContexto, conectar } from "./banco";

const META = { obras: 1000, ccts: 100, cidades: 500 };
const P = "perf_";
const TIPOLOGIAS = ["Supermercado", "Galpão logístico", "Academia", "Varejo", "Outras"];

/** Gerador determinístico (mesmos dados a cada execução). */
function sorteio(semente: number) {
  let x = semente >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

async function gerarCcts(api: Api) {
  const existentes = await api.ler<{ id: string }>("ccts?select=id");
  const ids = new Set(existentes.map((c) => c.id));
  let criadas = 0;
  // numeração que pula o que já existe: rodar de novo depois de uma execução parcial completa
  for (let n = 1; existentes.length + criadas < META.ccts; n++) {
    const id = `${P}cct_${String(n).padStart(3, "0")}`;
    if (ids.has(id)) continue;
    await api.rpc("duplicar_cct", { p_origem: "bh", p_id: id, p_nome: `Desempenho CCT ${n}` });
    criadas++;
  }
  console.log(`CCTs: ${existentes.length} + ${criadas}`);
}

async function gerarCidades(api: Api) {
  const existentes = await api.ler<{ id: string }>("cidades?select=id");
  const ccts = (await api.ler<{ id: string }>("ccts?select=id&order=id")).map((c) => c.id);
  const ids = new Set(existentes.map((c) => c.id));
  const novas = [];
  for (let n = 1; existentes.length + novas.length < META.cidades; n++) {
    const id = `${P}cid_${String(n).padStart(3, "0")}`;
    if (ids.has(id)) continue;
    novas.push({
      id,
      nome: `Cidade Desempenho ${n}`,
      uf: "MG",
      cct_id: ccts[n % ccts.length],
      tarifa_local: 5 + (n % 4),
      iss_pct: 2 + (n % 3),
    });
  }
  for (let k = 0; k < novas.length; k += 100) await api.inserir("cidades", novas.slice(k, k + 100));
  console.log(`cidades: ${existentes.length} + ${novas.length}`);
}

type Ctx = Awaited<ReturnType<typeof carregarContexto>>;

/** Uma obra sintética: curva de efetivo em sino, 8 a 14 funções, HE e faltas. */
function cargaSintetica(n: number, c: Ctx, cidades: string[]): CargaParaGravar {
  const r = sorteio(n * 7919);
  const meses = 6 + Math.floor(r() * 25);
  const ano = 2017 + Math.floor(r() * 8);
  const mes = 1 + Math.floor(r() * 12);
  const funcoes = [...c.funcoesIds].sort();
  const usadas = funcoes.filter(() => r() < 0.6).slice(0, 14);
  if (!usadas.includes("ped")) usadas.push("ped");
  const nomes = c.cadastro.nomesFuncoes;
  const rubricas: LinhaRubrica[] = [];
  const pessoas: LinhaPessoa[] = [];
  let seq = 0;
  const ativos = new Map<string, string[]>(); // função → matrículas no mês anterior
  for (let m = 0; m < meses; m++) {
    const comp = { ano: ano + Math.floor((mes - 1 + m) / 12), mes: ((mes - 1 + m) % 12) + 1 };
    const curva = Math.sin((Math.PI * (m + 1)) / (meses + 1));
    for (const f of usadas) {
      const alvo = Math.max(
        1,
        Math.round((f === "ped" || f === "serv" ? 8 : 2) * curva * r() * 1.6),
      );
      const antes = ativos.get(f) ?? [];
      const agora = antes.slice(0, alvo);
      while (agora.length < alvo) agora.push(`9${n}${String(++seq).padStart(4, "0")}`);
      ativos.set(f, agora);
      const salario = c.tabelas[c.vigente]?.salarios[f] ?? 2000;
      for (const matricula of agora) {
        const he = r() < 0.5 ? Math.round(r() * 20) : 0;
        const funcao = (nomes[f] ?? f).toUpperCase();
        pessoas.push({
          comp,
          matricula,
          funcao,
          dias: null,
          admitido: !antes.includes(matricula),
          desligado: m === meses - 1 && r() < 0.5,
          faltasHoras: r() < 0.1 ? 8 : 0,
          licencaDias: 0,
          feriasDias: 0,
          obra: null,
        });
        rubricas.push({
          comp,
          matricula,
          funcao,
          codigo: 1,
          descricao: "HORAS NORMAIS",
          referencia: 220,
          valor: salario,
        });
        if (he)
          rubricas.push({
            comp,
            matricula,
            funcao,
            codigo: 200,
            descricao: "HORAS EXTRAS 100%",
            referencia: he,
            valor: Math.round((salario / 220) * 2 * he * 100) / 100,
          });
      }
    }
  }
  const proventos = new Map<string, number>();
  for (const x of rubricas) {
    const k = `${x.comp.ano}-${x.comp.mes}`;
    proventos.set(k, (proventos.get(k) ?? 0) + x.valor);
  }
  const folha = {
    rubricas,
    pessoas,
    resumo: [...proventos].map(([k, v]) => {
      const [a, mm] = k.split("-").map(Number);
      return { comp: { ano: a!, mes: mm! }, proventos: Math.round(v * 100) / 100 };
    }),
    erros: [],
  };
  const dataBase = c.datasBase.includes(ano) ? ano : c.vigente;
  const dados = {
    id: `${P}${String(n).padStart(4, "0")}`,
    nome: `Obra Desempenho ${n}`,
    cliente: `Cliente ${1 + (n % 40)}`,
    tipologia: TIPOLOGIAS[n % TIPOLOGIAS.length]!,
    cidadeId: cidades[n % cidades.length] ?? null,
    area: 2000 + Math.round(r() * 18000),
    inicio: { ano, mes },
    meses,
    dataBase,
    trocas: [],
    feriados: [],
    premissas: {},
    regime: {},
  };
  const escolhas = {
    ...ESCOLHAS_VAZIAS,
    funcoes: Object.fromEntries(usadas.map((f) => [(nomes[f] ?? f).toUpperCase(), f])),
  };
  const parametros = parametrosEpoca(c.tabelas, dataBase, [], c.vigente);
  return montarCarga(dados, { folha }, c.cadastro, escolhas, parametros).payload;
}

/** Lê do banco o que o motor precisa de um lote de obras (como o app faz). */
async function obrasDoBanco(api: Api, ids: string[]): Promise<ObraBanco[]> {
  const em = `in.(${ids.join(",")})`;
  const [obras, comps, efetivo, regime, trocas, feriados] = await Promise.all([
    api.ler<ObraBanco["obra"]>(`obras?select=*&id=${em}`),
    api.ler<ObraBanco["competencias"][number]>(
      `competencias?select=*&obra_id=${em}&order=obra_id,mes_idx`,
    ),
    api.ler<ObraBanco["efetivo"][number]>(
      `efetivo_mes?select=*&obra_id=${em}&order=obra_id,funcao_id,mes_idx`,
    ),
    api.ler<ObraBanco["regime"][number] & { obra_id: string }>(
      `obra_regime?select=*&obra_id=${em}`,
    ),
    api.ler<ObraBanco["trocas"][number] & { obra_id: string }>(
      `obra_trocas_tabela?select=*&obra_id=${em}`,
    ),
    api.ler<ObraBanco["feriados"][number] & { obra_id: string }>(
      `obra_feriados?select=*&obra_id=${em}`,
    ),
  ]);
  return obras.map((obra) => ({
    obra,
    competencias: comps.filter((x) => x.obra_id === obra.id),
    efetivo: efetivo.filter((x) => x.obra_id === obra.id),
    regime: regime.filter((x) => x.obra_id === obra.id),
    trocas: trocas.filter((x) => x.obra_id === obra.id),
    feriados: feriados.filter((x) => x.obra_id === obra.id),
  }));
}

async function gerarObras(api: Api) {
  const c = await carregarContexto(api);
  const existentes = await api.ler<{ id: string }>("obras?select=id");
  const cidades = c.cidades.map((x) => x.id);
  const faltam = META.obras - existentes.length;
  const ids: string[] = [];
  const t0 = Date.now();
  for (let n = 1, feitas = 0; feitas < faltam; n++) {
    const id = `${P}${String(n).padStart(4, "0")}`;
    if (existentes.some((x) => x.id === id)) continue;
    await api.rpc("gravar_carga", { p: cargaSintetica(n, c, cidades) });
    ids.push(id);
    feitas++;
    if (feitas % 100 === 0)
      console.log(`obras: ${feitas}/${faltam} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  // resumo de cada obra pelo motor, como o app grava ao abrir a base
  const contexto = impressaoContexto(c.ctx, c.tabelas, c.vigente);
  for (let k = 0; k < ids.length; k += 50) {
    const lote = await obrasDoBanco(api, ids.slice(k, k + 50));
    const resumos = lote.map((b) => resumoDaObra(b, c.ctx, c.tabelas, c.vigente, contexto));
    await api.rpc("gravar_resumos", { p: resumos });
  }
  console.log(`obras: ${existentes.length} + ${ids.length}, com resumo`);
}

async function limpar(api: Api) {
  const obras = await api.ler<{ id: string }>(`obras?select=id&id=like.${P}*`);
  for (const o of obras) await api.rpc("excluir_obra", { p_id: o.id });
  await api.apagar(`cidades?id=like.${P}*`);
  await api.apagar(`ccts?id=like.${P}*`);
  console.log(`apagados: ${obras.length} obras, cidades e CCTs ${P}*`);
}

async function main() {
  const [cmd] = process.argv.slice(2);
  if (cmd !== "gerar" && cmd !== "limpar") {
    console.log("Uso: pnpm desempenho gerar|limpar (só no Supabase local)");
    process.exit(1);
  }
  const { api, url } = await conectar({});
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error("Os dados de desempenho só vão para o Supabase local.");
  if (cmd === "limpar") return limpar(api);
  await gerarCcts(api);
  await gerarCidades(api);
  await gerarObras(api);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
