/**
 * Projeção de quantidades (SPEC §5) e cenários de origem (§5.1).
 * Das referências vêm só quantidades (regra 1); os preços vêm de `parametros`.
 */
import type { Feriado } from "./calendario";
import { feriadosDaCidade, vtDiario, vtDiarioDe } from "./local";
import type { CidadeVt, FeriadoRecorrente } from "./local";
import { HE_MIX_PADRAO, PREMISSAS_PADRAO, TIPOS_HE, anoMes, nMeses } from "./modelo";
import type {
  Contexto,
  InicioObra,
  Obra,
  Origem,
  ParametrosObra,
  Premissas,
  Regime,
  TipoHe,
} from "./modelo";
import { cabecasMes } from "./movimentos";
import { calcularObra } from "./obra";
import type { ResultadoObra } from "./obra";

export type Estatistica = "media" | "mediana";

const soma = (a: readonly number[]) => a.reduce((s, v) => s + (Number(v) || 0), 0);
const media = (a: readonly number[]) => (a.length ? soma(a) / a.length : 0);
export function mediana(a: readonly number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Pessoa-mês total por mês (todas as funções da obra). */
export function totaisPorMes(o: Obra, funcoes: readonly string[]): number[] {
  return Array.from({ length: nMeses(o) }, (_, i) =>
    funcoes.reduce((s, k) => s + (o.equivalente[k]?.[i] ?? 0), 0),
  );
}

/**
 * Distribui a curva de uma referência (n meses) em N meses do novo prazo, pela sobreposição de
 * frações do prazo. A soma das frações é 1 (curva zerada: tudo 0).
 */
export function shares(curva: readonly number[], N: number): number[] {
  const n = curva.length;
  const total = soma(curva);
  const out: number[] = [];
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const sobre = Math.max(0, Math.min((i + 1) / n, (j + 1) / N) - Math.max(i / n, j / N));
      s += total ? ((sobre * curva[i]!) / total) * n : 0;
    }
    out.push(s);
  }
  return out;
}

export interface CidadeProjecao extends CidadeVt {
  feriados: readonly FeriadoRecorrente[];
}

export interface EntradaProjecao {
  id?: string;
  inicio: InicioObra;
  prazo: number;
  area: number;
  referencias: readonly Obra[];
  estatistica: Estatistica;
  /** mais ou menos gente por função, −100 a +100 (%); vale também sobre as quantidades informadas */
  ajustesPct?: Readonly<Record<string, number>>;
  /** substitui tudo quando todas as séries têm `prazo` meses */
  quantidadesManuais?: Readonly<Record<string, readonly number[]>> | null;
  heMedia?: number | null;
  absenteismoPct?: number | null;
  rotatividadePct?: number | null;
  /** licença: pessoa-dias por pessoa-mês */
  licencaPorPm?: number | null;
  feriasPorPm?: number | null;
  heMixPct?: Readonly<Record<TipoHe, number>> | null;
  premissas?: Partial<Premissas>;
  regime?: Readonly<Record<string, Regime>>;
  origem?: Readonly<Record<string, Origem>>;
  /** cidade da obra (preços já em `parametros`; aqui só VT por origem e feriados) */
  cidade?: CidadeProjecao | null;
  /** de onde vem quem viaja todo dia (quem chama escolhe; o protótipo usa BH). Sem ela, VT local. */
  cidadeOrigem?: CidadeVt | null;
  /** VT de referência sem cidade (tabela vigente) */
  vtDiariaReferencia: number;
  feriadosMunicipais?: readonly Feriado[];
}

export interface ResultadoProjecao {
  obra: Obra;
  resultado: ResultadoObra;
  /** pessoa-mês por mês */
  totais: number[];
  pessoaMes: number;
  pico: number;
  aplicadas: {
    heMedia: number;
    absenteismoPct: number;
    rotatividadePct: number;
    heMixPct: Record<TipoHe, number>;
    licencaPorPm: number;
    feriasPorPm: number;
  };
  /** pessoa-mês por 1.000 m² usado em cada função que escala com a área */
  pmPorMilM2: Record<string, number | null>;
  total: number;
}

/**
 * Pessoas por mês sempre inteiras (decisão do usuário, SPEC §5): até ,2 arredonda para baixo; de
 * ,3 em diante, para cima (1,2 → 1; 1,3 → 2). Tolerância para o ruído do ponto flutuante.
 */
export function pessoasInteiras(x: number): number {
  if (!(x > 0)) return 0;
  const base = Math.floor(x + 1e-9);
  return x - base <= 0.2 + 1e-9 ? base : base + 1;
}

function manualValido(e: EntradaProjecao): Readonly<Record<string, readonly number[]>> | null {
  const m = e.quantidadesManuais;
  if (!m) return null;
  return Object.values(m).every((a) => Array.isArray(a) && a.length === e.prazo) ? m : null;
}

export function projetar(
  e: EntradaProjecao,
  parametros: ParametrosObra,
  ctx: Contexto,
): ResultadoProjecao | null {
  const refs = e.referencias;
  const manual = manualValido(e);
  if ((!refs.length && !manual) || e.prazo <= 0) return null;
  const agg = e.estatistica === "mediana" ? mediana : media;
  const N = e.prazo;
  const ids = ctx.funcoes.map((f) => f.id);
  const q: Record<string, number[]> = {};
  const pmPorMilM2: Record<string, number | null> = {};

  for (const f of ctx.funcoes) {
    const k = f.id;
    if (manual) {
      const ajm = 1 + (e.ajustesPct?.[k] ?? 0) / 100;
      q[k] = (manual[k] ?? Array(N).fill(0)).map((v) => pessoasInteiras((Number(v) || 0) * ajm));
      pmPorMilM2[k] = null;
      continue;
    }
    const aj = 1 + (e.ajustesPct?.[k] ?? 0) / 100;
    if (!f.escalaArea) {
      // fixo por mês: média (ou mediana) das cabeças mensais das referências
      // sem cabeças na referência, vale o teto do equivalente (como em cabecasMes)
      const m = agg(
        refs.map((r) => {
          const n = nMeses(r);
          let c = 0;
          for (let i = 0; i < n; i++) c += cabecasMes(r, k, i);
          return n ? c / n : 0;
        }),
      );
      q[k] = Array(N).fill(pessoasInteiras(m * aj));
      pmPorMilM2[k] = null;
      continue;
    }
    // PM/1.000 m²: todas as referências (quem não teve a função entra com 0)
    const comArea = refs.filter((r) => r.area > 0);
    const pm = agg(comArea.map((r) => (soma(r.equivalente[k] ?? []) / r.area) * 1000)) * aj;
    // curva no tempo: só das referências que tiveram a função (decisão M3, SPEC §5)
    const curvas = comArea
      .map((r) => r.equivalente[k] ?? [])
      .filter((c) => soma(c) > 0)
      .map((c) => shares(c, N));
    const shm = Array.from({ length: N }, (_, j) => media(curvas.map((c) => c[j]!)));
    q[k] = shm.map((s) => pessoasInteiras(((pm * e.area) / 1000) * s));
    pmPorMilM2[k] = pm;
  }

  // premissas: informadas ou agregadas das referências (SPEC §5)
  const heMediaObra = (r: Obra) => {
    const t = totaisPorMes(r, ids);
    const n = soma(t);
    return n ? soma(t.map((x, i) => x * (r.heMedia[i] ?? 0))) / n : 0;
  };
  const absMedio = (r: Obra) => {
    const t = totaisPorMes(r, ids);
    const n = soma(t);
    return n ? soma(t.map((x, i) => x * (r.absenteismoPct[i] ?? 0))) / n : 0;
  };
  const heAp = e.heMedia ?? (refs.length ? agg(refs.map(heMediaObra)) : 15);
  const absAp = e.absenteismoPct ?? (refs.length ? agg(refs.map(absMedio)) : 3);
  const turnAp = e.rotatividadePct ?? (refs.length ? agg(refs.map((r) => r.rotatividadePct)) : 5);
  const mixAp: Record<TipoHe, number> = e.heMixPct
    ? { ...e.heMixPct }
    : refs.length
      ? (Object.fromEntries(
          TIPOS_HE.map((t) => [
            t,
            media(refs.map((r) => ({ ...HE_MIX_PADRAO, ...(r.heMixPct ?? {}) })[t])),
          ]),
        ) as Record<TipoHe, number>)
      : { ...HE_MIX_PADRAO };
  const taxa = (campo: "licencaPessoaDias" | "feriasPessoaDias") =>
    refs.length
      ? agg(
          refs.map((r) => {
            const m = soma(totaisPorMes(r, ids));
            return m ? soma(r[campo]) / m : 0;
          }),
        )
      : 0;
  const licAp = e.licencaPorPm ?? taxa("licencaPessoaDias");
  const ferAp = e.feriasPorPm ?? taxa("feriasPessoaDias");

  // VT por origem (só com cidade) e feriados da cidade em todos os anos do prazo
  const cid = e.cidade ?? null;
  const ultimoAno = anoMes(e.inicio, N - 1).ano;
  const feriadosCidade: Feriado[] = [];
  if (cid)
    for (let a = e.inicio.ano; a <= ultimoAno; a++)
      feriadosCidade.push(...feriadosDaCidade(cid.feriados, a));
  const origem: Record<string, Origem> = {};
  const vtPorFuncao: Record<string, number> = {};
  for (const k of ids) {
    const og = e.origem?.[k] ?? "local";
    origem[k] = og;
    // alojada não tem VT, com ou sem cidade (SPEC §4.4)
    vtPorFuncao[k] =
      og === "aloj"
        ? 0
        : !cid
          ? e.vtDiariaReferencia
          : og === "diaria"
            ? e.cidadeOrigem
              ? vtDiarioDe(cid, e.cidadeOrigem).valor
              : vtDiario(cid)
            : vtDiario(cid);
  }

  const obraBase: Obra = {
    id: e.id || "nova",
    inicio: e.inicio,
    area: e.area,
    equivalente: q,
    cabecas: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, [...v]])),
    heMedia: Array(N).fill(heAp),
    absenteismoPct: Array(N).fill(absAp),
    licencaPessoaDias: [],
    feriasPessoaDias: [],
    rotatividadePct: turnAp,
    heMixPct: mixAp,
    regime: e.regime ?? {},
    premissas: { ...PREMISSAS_PADRAO, ...(e.premissas ?? {}) },
    feriadosMunicipais: [...(e.feriadosMunicipais ?? []), ...feriadosCidade],
    origem,
    vtDiariaPorFuncao: vtPorFuncao,
  };
  const totais = totaisPorMes(obraBase, ids);
  const obra: Obra = {
    ...obraBase,
    licencaPessoaDias: totais.map((t) => Math.round(t * licAp)),
    feriasPessoaDias: totais.map((t) => Math.round(t * ferAp)),
  };
  const resultado = calcularObra(obra, parametros, ctx, { movimentos: "sinteticos" });
  return {
    obra,
    resultado,
    totais,
    pessoaMes: soma(totais),
    pico: totais.length ? Math.max(...totais) : 0,
    aplicadas: {
      heMedia: heAp,
      absenteismoPct: absAp,
      rotatividadePct: turnAp,
      heMixPct: mixAp,
      licencaPorPm: licAp,
      feriasPorPm: ferAp,
    },
    pmPorMilM2,
    total: resultado.total.total,
  };
}

export interface Cenario {
  nome: "planejado" | "local" | "diaria" | "aloj";
  total: number;
  vt: number;
  benef: number;
}

/**
 * Cenários de origem (§5.1): a mesma projeção com toda a MO local, vindo todo dia de fora e
 * alojada, contra o planejado.
 */
export function cenariosDeOrigem(
  e: EntradaProjecao,
  parametros: ParametrosObra,
  ctx: Contexto,
): Cenario[] {
  const todas = (og: Origem) => Object.fromEntries(ctx.funcoes.map((f) => [f.id, og]));
  const um = (nome: Cenario["nome"], origem: EntradaProjecao["origem"]): Cenario | null => {
    const r = projetar({ ...e, origem }, parametros, ctx);
    return r
      ? { nome, total: r.total, vt: r.resultado.total.vt, benef: r.resultado.total.benef }
      : null;
  };
  return [
    um("planejado", e.origem ?? {}),
    um("local", todas("local")),
    um("diaria", todas("diaria")),
    um("aloj", todas("aloj")),
  ].filter((c): c is Cenario => !!c);
}
