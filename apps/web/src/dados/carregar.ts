/**
 * Carregadores do cálculo (M14): os mesmos dados que a tela usa para calcular uma projeção, lidos
 * por qualquer cliente do Supabase. A tela passa o cliente do navegador; a Edge Function
 * `projecoes` passa o dela e refaz a aprovação no servidor com o mesmo código (sem React, sem
 * `import.meta.env`). Nada aqui grava.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cadastro, RubricaCadastro } from "@ito/carga";
import type { Contexto, CctPrecos, FeriadoRecorrente, Tabela } from "@ito/motor";
import { contextoDoBanco, tabelaDoBanco } from "../lib/motorDoBanco";
import type { ObraBanco } from "../lib/obraDoBanco";
import type { CidadeComPrecos, Precos } from "../lib/projecaoDoBanco";
import type { Database } from "../lib/tipos-banco";

export type Cliente = SupabaseClient<Database>;
type T = Database["public"]["Tables"];

export async function ok<R>(p: PromiseLike<{ data: R; error: unknown }>): Promise<NonNullable<R>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<R>;
}

/** Todas as linhas, de 1.000 em 1.000 (limite do PostgREST, `max_rows`). */
export async function todas<R>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: R[] | null; error: unknown }>,
): Promise<R[]> {
  const linhas: R[] = [];
  for (let de = 0; ; de += 1000) {
    const lote = await ok(pagina(de, de + 999));
    linhas.push(...lote);
    if (lote.length < 1000) return linhas;
  }
}

function agrupar<R, K extends string>(linhas: readonly R[], chave: (r: R) => K): Map<K, R[]> {
  const m = new Map<K, R[]>();
  for (const r of linhas) {
    const k = chave(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ── contexto: cadastros, tabela da empresa por data-base ────────────────────

export interface ContextoCarga {
  cadastro: Cadastro;
  ctx: Contexto;
  /** tabela da empresa por data-base (época) */
  tabelas: Record<number, Tabela>;
  vigente: number;
  datasBase: number[];
  justificativas: string[];
  /** funções ativas, para mapear e para criar sinônimo */
  funcoes: { id: string; nome: string }[];
  cidades: { id: string; nome: string; feriados: FeriadoRecorrente[] }[];
  obras: { id: string; nome: string }[];
}

export async function carregarContexto(c: Cliente): Promise<ContextoCarga> {
  const [
    funcoes,
    sinonimos,
    rubricas,
    beneficios,
    parametros,
    feriadosEmpresa,
    datas,
    salarios,
    valoresBen,
    encargos,
    just,
    cidades,
    ferCid,
    obras,
  ] = await Promise.all([
    ok(c.from("funcoes").select("*").order("nome")),
    // listas que crescem com as cargas: paginadas (limite de 1.000 linhas do PostgREST)
    todas((de, ate) => c.from("funcao_sinonimos").select("*").order("texto").range(de, ate)),
    todas((de, ate) => c.from("rubricas").select("*").order("codigo").range(de, ate)),
    ok(c.from("beneficios").select("*")),
    ok(c.from("parametros").select("*").single()),
    ok(c.from("feriados_empresa").select("*")),
    ok(c.from("datas_base").select("*").order("ano", { ascending: false })),
    todas((de, ate) =>
      c.from("data_base_salarios").select("*").order("ano").order("funcao_id").range(de, ate),
    ),
    todas((de, ate) =>
      c.from("data_base_beneficios").select("*").order("ano").order("beneficio_id").range(de, ate),
    ),
    todas((de, ate) =>
      c.from("data_base_encargos").select("*").order("ano").order("id").range(de, ate),
    ),
    ok(c.from("justificativas_erp").select("*").order("ordem")),
    todas((de, ate) =>
      c.from("cidades").select("id, nome, uf").order("nome").order("id").range(de, ate),
    ),
    todas((de, ate) => c.from("cidade_feriados").select("*").order("cidade_id").range(de, ate)),
    todas((de, ate) => c.from("obras").select("id, nome").order("nome").range(de, ate)),
  ]);

  const tabelas: Record<number, Tabela> = {};
  for (const d of datas) {
    const sal = Object.fromEntries(
      salarios.filter((s) => s.ano === d.ano).map((s) => [s.funcao_id, Number(s.valor)]),
    );
    const ben = Object.fromEntries(
      valoresBen.filter((b) => b.ano === d.ano).map((b) => [b.beneficio_id, Number(b.valor)]),
    );
    tabelas[d.ano] = tabelaDoBanco(
      d,
      sal,
      ben,
      encargos.filter((e) => e.ano === d.ano),
    );
  }

  const rubricasCad: RubricaCadastro[] = rubricas.map((r) => ({
    codigo: r.codigo,
    nome: r.nome,
    tipo: r.tipo,
    componente: r.componente,
    baseProvisoes: r.base_provisoes,
    tipoHe: (r.tipo_he as RubricaCadastro["tipoHe"]) ?? null,
  }));

  return {
    cadastro: {
      // inativas também: o histórico pode ter função que hoje não se usa
      funcoes: contextoDoBanco(funcoes, [], parametros, []).funcoes,
      nomesFuncoes: Object.fromEntries(funcoes.map((f) => [f.id, f.nome])),
      sinonimos: Object.fromEntries(sinonimos.map((s) => [s.texto, s.funcao_id])),
      rubricas: rubricasCad,
    },
    ctx: contextoDoBanco(funcoes, beneficios, parametros, feriadosEmpresa),
    tabelas,
    vigente: parametros.data_base_vigente ?? datas[0]?.ano ?? new Date().getFullYear(),
    datasBase: datas.map((d) => d.ano),
    justificativas: just.map((j) => j.texto),
    funcoes: funcoes.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome })),
    cidades: cidades.map((x) => ({
      id: x.id,
      nome: `${x.nome}/${x.uf}`,
      feriados: ferCid
        .filter((f) => f.cidade_id === x.id)
        .map((f) => ({ dia: f.dia, mes: f.mes, nome: f.nome })),
    })),
    obras,
  };
}

// ── cidades e CCTs ───────────────────────────────────────────────────────────

export type Cidade = T["cidades"]["Row"] & {
  feriados: { mes: number; dia: number; nome: string }[];
  passagens: Record<string, number>;
};
export interface DetalheCct {
  salarios: Record<string, number>;
  gratificacoes: Record<string, number>;
  beneficios: Record<string, number>;
}
export type CctComPrecos = CctPrecos & { id: string; nome: string };

export const nomeCidade = (x: { nome: string; uf: string }) => `${x.nome}/${x.uf}`;

export async function carregarCidades(c: Cliente): Promise<Cidade[]> {
  const [cidades, fer, pas] = await Promise.all([
    todas((de, ate) => c.from("cidades").select("*").order("nome").order("id").range(de, ate)),
    todas((de, ate) =>
      c
        .from("cidade_feriados")
        .select("*")
        .order("cidade_id")
        .order("mes")
        .order("dia")
        .range(de, ate),
    ),
    todas((de, ate) =>
      c.from("cidade_passagens").select("*").order("cidade_id").order("origem_id").range(de, ate),
    ),
  ]);
  const ferPor = agrupar(fer, (f) => f.cidade_id);
  const pasPor = agrupar(pas, (p) => p.cidade_id);
  return cidades.map((x) => ({
    ...x,
    feriados: (ferPor.get(x.id) ?? []).map((f) => ({ mes: f.mes, dia: f.dia, nome: f.nome })),
    passagens: Object.fromEntries(
      (pasPor.get(x.id) ?? []).map((p) => [p.origem_id, Number(p.valor)]),
    ),
  }));
}

/** Salários, gratificações e benefícios de uma CCT (usado pelo editor e pela comparação). */
export async function carregarCct(c: Cliente, id: string): Promise<DetalheCct> {
  const [sal, grat, ben] = await Promise.all([
    ok(c.from("cct_salarios").select("funcao_id, valor").eq("cct_id", id)),
    ok(c.from("cct_gratificacoes").select("funcao_id, valor").eq("cct_id", id)),
    ok(c.from("cct_beneficios").select("beneficio_id, valor").eq("cct_id", id)),
  ]);
  return {
    salarios: Object.fromEntries(sal.map((r) => [r.funcao_id, Number(r.valor)])),
    gratificacoes: Object.fromEntries(grat.map((r) => [r.funcao_id, Number(r.valor)])),
    beneficios: Object.fromEntries(ben.map((r) => [r.beneficio_id, Number(r.valor)])),
  };
}

/** CCT da cidade com os preços que o motor usa (mês da data-base e reajuste estimado). */
export async function carregarCctPrecos(c: Cliente, cctId: string): Promise<CctComPrecos> {
  const [linha, det] = await Promise.all([
    ok(c.from("ccts").select("*").eq("id", cctId).single()),
    carregarCct(c, cctId),
  ]);
  return {
    id: linha.id,
    nome: linha.nome,
    mesDataBase: linha.mes_data_base,
    reajusteEstimadoPct: Number(linha.reajuste_estimado_pct),
    ...det,
  };
}

export const cidadeComPrecos = (x: Cidade): CidadeComPrecos => ({
  id: x.id,
  nome: nomeCidade(x),
  cctId: x.cct_id,
  tarifaLocal: Number(x.tarifa_local),
  conducoes: x.conducoes,
  issPct: Number(x.iss_pct),
  passagens: x.passagens,
  feriados: x.feriados,
});

/** Cidade de origem padrão de quem vem todo dia (como o protótipo): BH, se não for a da obra. */
export const origemPadrao = (cidades: readonly { id: string }[], cidadeId: string | null) =>
  cidades.find((x) => x.id === "bh" && x.id !== cidadeId)?.id ??
  cidades.find((x) => x.id !== cidadeId)?.id ??
  null;

/** Preços da projeção a partir dos cadastros já carregados (nulo se falta a CCT da cidade). */
export function montarPrecos(
  tabela: Tabela | undefined,
  cidades: readonly Cidade[],
  cidadeId: string | null,
  origemId: string | null,
  cct: CctComPrecos | undefined,
): Precos | null {
  const cid = cidades.find((x) => x.id === cidadeId) ?? null;
  if (!tabela || (cid && !cct)) return null;
  const orig = origemId ?? origemPadrao(cidades, cidadeId);
  const de = cidades.find((x) => x.id === orig && x.id !== cidadeId) ?? null;
  return {
    vigente: tabela,
    cidade: cid ? cidadeComPrecos(cid) : null,
    cidadeOrigem: de ? cidadeComPrecos(de) : null,
    cct: cid ? cct! : null,
  };
}

// ── obras com os dados de cálculo ────────────────────────────────────────────

/**
 * Dados de cálculo de várias obras (resumo, referências da projeção), em lotes de 50, até 4 lotes
 * ao mesmo tempo (M12: em sequência, 1.000 obras levavam 20 rodadas). A ordem dos ids fica.
 */
export async function carregarObrasBanco(c: Cliente, ids: readonly string[]): Promise<ObraBanco[]> {
  const lotes: string[][] = [];
  for (let k = 0; k < ids.length; k += 50) lotes.push(ids.slice(k, k + 50));
  const resultados: ObraBanco[][] = Array.from({ length: lotes.length }, () => []);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, lotes.length) }, async () => {
      while (proximo < lotes.length) {
        const i = proximo++;
        resultados[i] = await carregarLote(c, lotes[i]!);
      }
    }),
  );
  return resultados.flat();
}

async function carregarLote(c: Cliente, lote: readonly string[]): Promise<ObraBanco[]> {
  const [obras, comps, efetivo, regime, trocas, feriados] = await Promise.all([
    ok(c.from("obras").select("*").in("id", lote)),
    // ordem estável entre páginas (LIMIT/OFFSET sem ORDER BY pula ou repete linhas)
    todas((de, ate) =>
      c
        .from("competencias")
        .select("*")
        .in("obra_id", lote)
        .order("obra_id")
        .order("mes_idx")
        .range(de, ate),
    ),
    todas((de, ate) =>
      c
        .from("efetivo_mes")
        .select("*")
        .in("obra_id", lote)
        .order("obra_id")
        .order("funcao_id")
        .order("mes_idx")
        .range(de, ate),
    ),
    todas((de, ate) =>
      c
        .from("obra_regime")
        .select("*")
        .in("obra_id", lote)
        .order("obra_id")
        .order("funcao_id")
        .range(de, ate),
    ),
    todas((de, ate) =>
      c
        .from("obra_trocas_tabela")
        .select("*")
        .in("obra_id", lote)
        .order("obra_id")
        .order("mes_idx")
        .range(de, ate),
    ),
    todas((de, ate) =>
      c
        .from("obra_feriados")
        .select("*")
        .in("obra_id", lote)
        .order("obra_id")
        .order("data")
        .range(de, ate),
    ),
  ]);
  return obras.map((o) => ({
    obra: o,
    competencias: comps.filter((x) => x.obra_id === o.id),
    efetivo: efetivo.filter((x) => x.obra_id === o.id),
    regime: regime.filter((x) => x.obra_id === o.id),
    trocas: trocas.filter((x) => x.obra_id === o.id),
    feriados: feriados.filter((x) => x.obra_id === o.id),
  }));
}
