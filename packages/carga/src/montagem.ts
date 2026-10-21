/**
 * Montagem da obra a partir da folha (PLAN M4): lançamentos por matrícula e as quantidades que a
 * projeção vai reutilizar (regra 1: só quantidades, nunca R$ de obra antiga).
 *
 * Por competência (SPEC §1.2; inversas das fórmulas do §4, para o motor reproduzir as horas):
 * - pessoa-mês da matrícula = dias de vínculo ÷ dias do mês (vazio = 1);
 * - licença e férias = Σ dias informados (pessoa-dias);
 * - absenteísmo = Σ faltas (h) ÷ (pessoa-mês pago × divisor), pessoa-mês pago = x − (lic + fér) ÷ 30;
 * - HE média = Σ horas das rubricas de HE ÷ Σ_f (presentes_f × fator de HE_f), sem estágio;
 * - mix de HE = horas por tipo ÷ horas totais na obra (rubrica de HE sem tipo conta como úteis);
 * - rotatividade = Σ mín(admissões, desligamentos) ÷ Σ cabeças, nos meses i ≥ 1 (inversa do §4.6).
 * MDO realocada (trabalhou em outra obra) fica fora do efetivo e das quantidades.
 */
import type {
  Funcao,
  InicioObra,
  Movimentos,
  Obra,
  ParametrosObra,
  Premissas,
  Regime,
  TipoHe,
} from "@ito/motor";
import { HE_MIX_PADRAO, TIPOS_HE, tabelaDoMes } from "@ito/motor";
import type { LeituraFolha, LinhaErp, LinhaPonto, LinhaVt, NotaFiscal } from "./leitores";
import type { Competencia } from "./planilha";

export type TipoRubrica = "provento" | "desconto" | "informativo";
export type ComponenteRubrica =
  | "sal"
  | "extras"
  | "he"
  | "dsr"
  | "faltas"
  | "resc"
  | "ferr"
  | "provpaga"
  | "compgps"
  | "nao"
  | "info";

export interface RubricaCadastro {
  codigo: number;
  nome: string;
  tipo: TipoRubrica;
  componente: ComponenteRubrica;
  baseProvisoes: boolean;
  tipoHe: TipoHe | null;
}

/** Cadastros do ITO usados na carga. */
export interface Cadastro {
  funcoes: readonly Funcao[];
  /** id → nome (a função da folha com o mesmo nome é mapeada sozinha) */
  nomesFuncoes: Readonly<Record<string, string>>;
  /** texto da folha (caixa alta) → função padrão */
  sinonimos: Readonly<Record<string, string>>;
  rubricas: readonly RubricaCadastro[];
}

export interface DadosObra {
  id: string;
  nome: string;
  cliente: string;
  tipologia: string;
  cidadeId: string | null;
  area: number;
  inicio: InicioObra;
  meses: number;
  dataBase: number;
  /** troca de tabela no meio da obra */
  trocas: readonly { mesIdx: number; dataBase: number; motivo: string }[];
  /** feriados municipais com data completa (aaaa-mm-dd) */
  feriados: readonly { data: string; nome: string }[];
  premissas: Partial<Premissas>;
  regime: Readonly<Record<string, Regime>>;
}

export interface Leituras {
  folha: LeituraFolha;
  ponto?: readonly LinhaPonto[] | null;
  vt?: readonly LinhaVt[] | null;
  erp?: readonly LinhaErp[] | null;
  notas?: readonly NotaFiscal[] | null;
}

/** Escolhas de quem carrega, nas etapas Funções, Rubricas e Verificação. */
export interface Escolhas {
  /** texto da folha → função padrão (vira sinônimo ao gravar) */
  funcoes: Readonly<Record<string, string>>;
  rubricasNovas: Readonly<Record<number, Omit<RubricaCadastro, "codigo">>>;
  /** confirma que quem está sem VT optou por não receber */
  semVtConfirmado: boolean;
  /** `cnpj|número` → mês da obra (NF sem competência no XML) */
  nfMes: Readonly<Record<string, number>>;
  /** obra escrita na folha → obra de destino (nome e, se estiver na base, o código) */
  realocacao: Readonly<Record<string, { nome: string; obraId: string | null }>>;
  /** mês → justificativa da diferença com o ERP */
  justificativas: Readonly<Record<number, string>>;
}

export const ESCOLHAS_VAZIAS: Escolhas = {
  funcoes: {},
  rubricasNovas: {},
  semVtConfirmado: false,
  nfMes: {},
  realocacao: {},
  justificativas: {},
};

/** Payload de `gravar_carga` (supabase/migrations/…_base_historica.sql). */
export interface CargaParaGravar {
  obra: Record<string, unknown>;
  substituir?: boolean;
  trocas: { mes_idx: number; data_base: number; motivo: string }[];
  feriados: { data: string; nome: string }[];
  regime: { funcao_id: string; regime: Regime }[];
  sinonimos: { texto: string; funcao_id: string }[];
  rubricas_novas: {
    codigo: number;
    nome: string;
    tipo: TipoRubrica;
    componente: ComponenteRubrica;
    base_provisoes: boolean;
    tipo_he: TipoHe | null;
  }[];
  competencias: {
    mes_idx: number;
    he_media: number;
    absenteismo_pct: number;
    licenca_pessoa_dias: number;
    ferias_pessoa_dias: number;
    ito_apropriado: number | null;
    erp_realizado: number | null;
    justificativa: string | null;
  }[];
  lancamentos: LancamentoCarga[];
  realocacoes: {
    tipo: "cedida";
    funcao_id: string;
    mes_ini: number;
    mes_fim: number;
    qtd: number;
    outra_obra: string;
    outra_obra_id: string | null;
    saldo_vt: number;
  }[];
  notas: {
    prestador_cnpj: string;
    numero: string;
    mes_idx: number | null;
    valor: number;
    iss: number;
    pis: number;
    cofins: number;
    inss: number;
    ir: number;
    csll: number;
  }[];
  erp: { mes_idx: number; conta: string; valor: number }[];
}

export interface LancamentoCarga {
  mes_idx: number;
  matricula: string;
  funcao_id: string;
  equivalente: number;
  horas_extras: number;
  faltas_horas: number;
  licenca_dias: number;
  ferias_dias: number;
  admitido: boolean;
  desligado: boolean;
  sem_vt: boolean;
  vt_valor: number | null;
  realocada_para: string | null;
  rubricas: { codigo: number; referencia: number; valor: number }[];
}

export interface Pendencias {
  /** funções da folha sem função padrão, com quantas matrículas */
  funcoes: { texto: string; matriculas: number }[];
  /** rubricas da folha sem cadastro nem classificação */
  rubricas: { codigo: number; descricao: string }[];
  /** competências fora do período informado da obra */
  foraDoPeriodo: Competencia[];
}

export interface Montagem {
  payload: CargaParaGravar;
  /** a obra no formato do motor (para a conferência e a apropriação) */
  obra: Obra;
  movimentos: Movimentos;
  pendencias: Pendencias;
  /** HE por tipo na obra (horas) */
  heHorasPorTipo: Record<TipoHe, number>;
  /** a folha não tem a aba Pessoas: pessoa-mês = 1 por matrícula */
  semAbaPessoas: boolean;
}

export const mesDaObra = (inicio: InicioObra, c: Competencia) =>
  (c.ano - inicio.ano) * 12 + c.mes - inicio.mes;
const diasNoMes = (c: Competencia) => new Date(Date.UTC(c.ano, c.mes, 0)).getUTCDate();
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r2 = (v: number) => Math.round(v * 100) / 100;
const normal = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

/** Função padrão de um texto da folha: escolha > sinônimo > mesmo nome. Vazio = pendente. */
export function funcaoDoTexto(texto: string, cadastro: Cadastro, escolhas: Escolhas): string {
  const e = escolhas.funcoes[texto];
  if (e) return e;
  const s = cadastro.sinonimos[texto];
  if (s) return s;
  const alvo = normal(texto);
  return Object.entries(cadastro.nomesFuncoes).find(([, n]) => normal(n) === alvo)?.[0] ?? "";
}

/** Rubrica do cadastro ou classificada nesta carga (incompleta = pendente). */
export function rubricaDe(
  codigo: number,
  cadastro: Cadastro,
  escolhas: Escolhas,
): RubricaCadastro | null {
  const c = cadastro.rubricas.find((r) => r.codigo === codigo);
  if (c) return c;
  const n = escolhas.rubricasNovas[codigo];
  return n && n.tipo && n.componente && n.nome ? { ...n, codigo } : null;
}

/** Duração da obra a partir das competências da folha (primeira e última). */
export function periodoDaFolha(folha: LeituraFolha): { inicio: InicioObra; meses: number } | null {
  const comps = [...folha.rubricas, ...folha.pessoas].map((l) => l.comp);
  if (!comps.length) return null;
  const k = (c: Competencia) => c.ano * 12 + c.mes;
  const ini = comps.reduce((a, b) => (k(b) < k(a) ? b : a));
  const fim = comps.reduce((a, b) => (k(b) > k(a) ? b : a));
  return { inicio: { ano: ini.ano, mes: ini.mes }, meses: k(fim) - k(ini) + 1 };
}

export function montarCarga(
  dados: DadosObra,
  leituras: Leituras,
  cadastro: Cadastro,
  escolhas: Escolhas,
  parametros: ParametrosObra,
): Montagem {
  const { folha } = leituras;
  const N = dados.meses;
  const funcoes = new Map(cadastro.funcoes.map((f) => [f.id, f]));
  const pend: Pendencias = { funcoes: [], rubricas: [], foraDoPeriodo: [] };

  // pendências de função e de rubrica
  const textos = new Map<string, Set<string>>();
  for (const l of [...folha.rubricas, ...folha.pessoas]) {
    if (!textos.has(l.funcao)) textos.set(l.funcao, new Set());
    textos.get(l.funcao)!.add(l.matricula);
  }
  const mapa = new Map<string, string>();
  for (const [t, mats] of textos) {
    const id = funcaoDoTexto(t, cadastro, escolhas);
    if (id && funcoes.has(id)) mapa.set(t, id);
    else pend.funcoes.push({ texto: t, matriculas: mats.size });
  }
  const descricoes = new Map<number, string>();
  for (const r of folha.rubricas)
    if (!descricoes.has(r.codigo)) descricoes.set(r.codigo, r.descricao);
  for (const [codigo, descricao] of descricoes)
    if (!rubricaDe(codigo, cadastro, escolhas)) pend.rubricas.push({ codigo, descricao });
  pend.rubricas.sort((a, b) => a.codigo - b.codigo);

  const foraVistos = new Set<string>();
  const noPeriodo = (c: Competencia) => {
    const i = mesDaObra(dados.inicio, c);
    if (i >= 0 && i < N) return i;
    const k = `${c.ano}-${c.mes}`;
    if (!foraVistos.has(k)) {
      foraVistos.add(k);
      pend.foraDoPeriodo.push(c);
    }
    return -1;
  };

  // lançamentos por (mês, matrícula, função)
  const lanc = new Map<string, LancamentoCarga>();
  const chave = (i: number, m: string, f: string) => `${i}|${m}|${f}`;
  const obter = (i: number, matricula: string, funcao_id: string) => {
    const k = chave(i, matricula, funcao_id);
    let l = lanc.get(k);
    if (!l) {
      l = {
        mes_idx: i,
        matricula,
        funcao_id,
        equivalente: 1,
        horas_extras: 0,
        faltas_horas: 0,
        licenca_dias: 0,
        ferias_dias: 0,
        admitido: false,
        desligado: false,
        sem_vt: false,
        vt_valor: null,
        realocada_para: null,
        rubricas: [],
      };
      lanc.set(k, l);
    }
    return l;
  };

  const semAbaPessoas = folha.pessoas.length === 0;
  for (const p of folha.pessoas) {
    const f = mapa.get(p.funcao);
    const i = noPeriodo(p.comp);
    if (!f || i < 0) continue;
    const l = obter(i, p.matricula, f);
    l.equivalente = p.dias === null ? 1 : r4(Math.min(1, p.dias / diasNoMes(p.comp)));
    l.faltas_horas = p.faltasHoras;
    l.licenca_dias = p.licencaDias;
    l.ferias_dias = p.feriasDias;
    l.admitido = p.admitido;
    l.desligado = p.desligado;
    if (p.obra) {
      const destino = escolhas.realocacao[p.obra];
      l.realocada_para = destino?.nome || p.obra;
    }
  }

  const heTipo: Record<TipoHe, number> = { util: 0, sabado: 0, intervalo: 0, feriado: 0 };
  for (const r of folha.rubricas) {
    const f = mapa.get(r.funcao);
    const i = noPeriodo(r.comp);
    if (!f || i < 0) continue;
    const l = obter(i, r.matricula, f);
    l.rubricas.push({ codigo: r.codigo, referencia: r.referencia, valor: r.valor });
    const rub = rubricaDe(r.codigo, cadastro, escolhas);
    if (rub?.componente === "he") {
      l.horas_extras = r2(l.horas_extras + r.referencia);
      if (!l.realocada_para) heTipo[rub.tipoHe ?? "util"] += r.referencia;
    }
  }

  // VT: valor por matrícula e quem ficou sem (confirmação na verificação)
  if (leituras.vt) {
    const vt = new Map<string, number>();
    for (const v of leituras.vt) {
      const i = mesDaObra(dados.inicio, v.comp);
      vt.set(`${i}|${v.matricula}`, (vt.get(`${i}|${v.matricula}`) ?? 0) + v.valor);
    }
    for (const l of lanc.values()) {
      const v = vt.get(`${l.mes_idx}|${l.matricula}`);
      l.vt_valor = v === undefined ? null : r2(v);
      l.sem_vt = v === undefined && escolhas.semVtConfirmado && !l.realocada_para;
    }
  }

  const lancamentos = [...lanc.values()].sort(
    (a, b) =>
      a.mes_idx - b.mes_idx ||
      a.funcao_id.localeCompare(b.funcao_id) ||
      a.matricula.localeCompare(b.matricula),
  );
  const daObra = lancamentos.filter((l) => !l.realocada_para);

  // efetivo, cabeças e movimentos por função e mês
  const ids = [...new Set(daObra.map((l) => l.funcao_id))];
  const serie = () => Object.fromEntries(ids.map((f) => [f, Array<number>(N).fill(0)]));
  const equivalente = serie();
  const cabecas = serie();
  const admissoes = serie();
  const desligamentos = serie();
  const lic = Array<number>(N).fill(0);
  const fer = Array<number>(N).fill(0);
  const faltas = Array<number>(N).fill(0);
  const he = Array<number>(N).fill(0);
  for (const l of daObra) {
    const i = l.mes_idx;
    equivalente[l.funcao_id]![i]! += l.equivalente;
    cabecas[l.funcao_id]![i]! += 1;
    if (l.admitido) admissoes[l.funcao_id]![i]! += 1;
    if (l.desligado) desligamentos[l.funcao_id]![i]! += 1;
    lic[i]! += l.licenca_dias;
    fer[i]! += l.ferias_dias;
    faltas[i]! += l.faltas_horas;
    he[i]! += l.horas_extras;
  }
  for (const f of ids) equivalente[f] = equivalente[f]!.map(r4);

  const heMedia: number[] = [];
  const absenteismoPct: number[] = [];
  for (let i = 0; i < N; i++) {
    const tot = ids.reduce((s, f) => s + equivalente[f]![i]!, 0);
    const divisor = tabelaDoMes(parametros, i).divisor;
    const pago = Math.max(0, tot - (lic[i]! + fer[i]!) / 30);
    const a = pago > 0 ? Math.min(0.9, faltas[i]! / (pago * divisor)) : 0;
    absenteismoPct.push(r4(a * 100));
    // presentes ponderados pelo fator de HE, com o mesmo rateio de ausências do motor (§4.1)
    let base = 0;
    for (const f of ids) {
      const fun = funcoes.get(f)!;
      if (fun.vinculo === "estagio") continue;
      const x = equivalente[f]![i]!;
      const xa = tot > 0 ? Math.max(0, x - ((lic[i]! + fer[i]!) * (x / tot)) / 30) : 0;
      base += xa * (1 - a) * fun.fatorHe;
    }
    heMedia.push(base > 0 ? r4(he[i]! / base) : 0);
  }

  const heTotal = TIPOS_HE.reduce((s, t) => s + heTipo[t], 0);
  const mix: Record<TipoHe, number> = heTotal
    ? {
        util: 0,
        sabado: r4((heTipo.sabado / heTotal) * 100),
        intervalo: r4((heTipo.intervalo / heTotal) * 100),
        feriado: r4((heTipo.feriado / heTotal) * 100),
      }
    : { ...HE_MIX_PADRAO };
  if (heTotal) mix.util = r4(100 - mix.sabado - mix.intervalo - mix.feriado);

  let churn = 0;
  let cabs = 0;
  for (const f of ids)
    for (let i = 1; i < N; i++) {
      churn += Math.min(admissoes[f]![i]!, desligamentos[f]![i]!);
      cabs += cabecas[f]![i]!;
    }
  const rotatividadePct = cabs ? r4(Math.min(100, (churn / cabs) * 100)) : 0;

  // MDO realocada: agrupada por obra de destino e função
  const grupos = new Map<
    string,
    { ls: LancamentoCarga[]; destino: string; obraId: string | null }
  >();
  for (const l of lancamentos.filter((x) => x.realocada_para)) {
    const origem = folha.pessoas.find(
      (p) => p.matricula === l.matricula && mesDaObra(dados.inicio, p.comp) === l.mes_idx,
    )?.obra;
    const escolha = origem ? escolhas.realocacao[origem] : undefined;
    const k = `${l.realocada_para}|${l.funcao_id}`;
    if (!grupos.has(k))
      grupos.set(k, { ls: [], destino: l.realocada_para!, obraId: escolha?.obraId ?? null });
    grupos.get(k)!.ls.push(l);
  }
  const realocacoes = [...grupos.values()].map((g) => ({
    tipo: "cedida" as const,
    funcao_id: g.ls[0]!.funcao_id,
    mes_ini: Math.min(...g.ls.map((l) => l.mes_idx)),
    mes_fim: Math.max(...g.ls.map((l) => l.mes_idx)),
    qtd: new Set(g.ls.map((l) => l.matricula)).size,
    outra_obra: g.destino,
    outra_obra_id: g.obraId,
    saldo_vt: r2(g.ls.reduce((s, l) => s + (l.vt_valor ?? 0), 0)),
  }));

  const premissas: Partial<Premissas> = { ...dados.premissas };
  const obra: Obra = {
    id: dados.id,
    inicio: dados.inicio,
    meses: N,
    area: dados.area,
    equivalente,
    cabecas,
    heMedia,
    absenteismoPct,
    licencaPessoaDias: lic.map(r2),
    feriasPessoaDias: fer.map(r2),
    rotatividadePct,
    heMixPct: mix,
    regime: dados.regime,
    premissas,
    feriadosMunicipais: dados.feriados,
  };

  const novas = Object.entries(escolhas.rubricasNovas)
    .map(([c, r]) => ({ ...r, codigo: Number(c) }))
    .filter(
      (r) => descricoes.has(r.codigo) && !cadastro.rubricas.some((x) => x.codigo === r.codigo),
    );

  const pr = premissas;
  const payload: CargaParaGravar = {
    obra: {
      id: dados.id,
      nome: dados.nome.trim(),
      cliente: dados.cliente.trim(),
      tipologia: dados.tipologia.trim(),
      cidade_id: dados.cidadeId,
      area_m2: dados.area,
      inicio: `${dados.inicio.ano}-${String(dados.inicio.mes).padStart(2, "0")}-01`,
      meses: N,
      data_base: dados.dataBase,
      fora_da_sede: pr.foraDaSede ?? false,
      grat_premios_pct: pr.gratPremiosPct,
      transf_pct: pr.transfPct,
      funcoes_transferidas: pr.funcoesTransferidas ?? [],
      risco_pct: pr.riscoPct,
      lucro_pct: pr.lucroPct,
      trib_lucro_pct: pr.tribLucroPct,
      provisionar: pr.provisionar,
      adiantamento: pr.adiantamento,
      adiantamento_pct: pr.adiantamentoPct,
      rotatividade_pct: rotatividadePct,
      he_mix_util: mix.util,
      he_mix_sabado: mix.sabado,
      he_mix_intervalo: mix.intervalo,
      he_mix_feriado: mix.feriado,
    },
    trocas: dados.trocas.map((t) => ({
      mes_idx: t.mesIdx,
      data_base: t.dataBase,
      motivo: t.motivo,
    })),
    feriados: dados.feriados.map((f) => ({ data: f.data, nome: f.nome })),
    regime: Object.entries(dados.regime)
      .filter(([, r]) => r === "sp")
      .map(([funcao_id, regime]) => ({ funcao_id, regime })),
    sinonimos: Object.entries(escolhas.funcoes)
      .filter(([t, f]) => textos.has(t) && funcoes.has(f) && cadastro.sinonimos[t] !== f)
      .map(([texto, funcao_id]) => ({ texto, funcao_id })),
    rubricas_novas: novas.map((r) => ({
      codigo: r.codigo,
      nome: r.nome,
      tipo: r.tipo,
      componente: r.componente,
      base_provisoes: r.baseProvisoes,
      tipo_he: r.componente === "he" ? r.tipoHe : null,
    })),
    competencias: Array.from({ length: N }, (_, i) => ({
      mes_idx: i,
      he_media: heMedia[i]!,
      absenteismo_pct: absenteismoPct[i]!,
      licenca_pessoa_dias: r2(lic[i]!),
      ferias_pessoa_dias: r2(fer[i]!),
      ito_apropriado: null,
      erp_realizado: null,
      justificativa: null,
    })),
    lancamentos,
    realocacoes,
    notas: (leituras.notas ?? []).map((n) => {
      const k = `${n.prestadorCnpj}|${n.numero}`;
      // competência do XML dentro do período; senão, o mês escolhido na verificação
      const doXml = n.comp ? mesDaObra(dados.inicio, n.comp) : -1;
      const i = doXml >= 0 && doXml < N ? doXml : escolhas.nfMes[k];
      return {
        prestador_cnpj: n.prestadorCnpj,
        numero: n.numero,
        mes_idx: i === undefined ? null : i,
        valor: n.valor,
        iss: n.iss,
        pis: n.pis,
        cofins: n.cofins,
        inss: n.inss,
        ir: n.ir,
        csll: n.csll,
      };
    }),
    erp: (leituras.erp ?? [])
      .map((e) => ({
        mes_idx: mesDaObra(dados.inicio, e.comp),
        conta: e.conta,
        valor: r2(e.valor),
      }))
      .filter((e) => e.mes_idx >= 0 && e.mes_idx < N),
  };

  return {
    payload,
    obra,
    movimentos: { admissoes, desligamentos },
    pendencias: pend,
    heHorasPorTipo: heTipo,
    semAbaPessoas,
  };
}
