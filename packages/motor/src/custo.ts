/**
 * Custo de uma função num mês — `custo(o, f, i, p)` (SPEC §4.1 a §4.4).
 * Cada componente é exposto separado para ser rastreável até a fórmula (regra 5).
 */
import { diasDoMes } from "./calendarioObra";
import { taxasEncargos } from "./encargos";
import { HE_MIX_PADRAO, PREMISSAS_PADRAO, TIPOS_HE, tabelaDoMes } from "./modelo";
import type { Contexto, Funcao, Obra, ParametrosObra, Premissas, Regime, TipoHe } from "./modelo";
import { cabecasMes } from "./movimentos";
import { salarioComOrigem } from "./parametros";
import type { OrigemSalario } from "./parametros";

/** Cotas de salário-família por trabalhador elegível (média), como no protótipo. */
export const COTAS_SALARIO_FAMILIA = 0.6;
/** Desconto do VT do empregado: 6% do salário bruto (SPEC §4.4). */
export const DESCONTO_VT = 0.06;
/** Absenteísmo limitado a 90% (SPEC §4). */
export const ABSENTEISMO_MAX = 0.9;

export type RegimeCalculo = "estagio" | Regime;

export interface Adicionais {
  grat: number;
  peric: number;
  insal: number;
  transf: number;
  /** gratificação fixa da CCT */
  gratF: number;
  not: number;
  dsrNot: number;
}

export interface CustoMes {
  funcaoId: string;
  regime: RegimeCalculo;
  /** pessoa-mês equivalente */
  x: number;
  /** pessoa-mês pago como salário (descontadas licenças e férias) */
  xa: number;
  /** pessoa-mês presente (descontado o absenteísmo) */
  pres: number;
  salario: number;
  /** de onde veio o salário: tabela, oficial (sem salário da função) ou ausente */
  salarioOrigem: OrigemSalario;
  /** absenteísmo (fração) */
  a: number;
  licD: number;
  ferD: number;
  dsrPct: number;
  diasTrabalhados: number;
  bruto: number;
  faltasH: number;
  faltasD: number;
  faltas: number;
  salv: number;
  bolsa: number;
  adicionais: Adicionais;
  extras: number;
  /** horas extras por pessoa no mês (com o fator da função) */
  horasPorPessoa: number;
  heTipo: Record<TipoHe, number>;
  he: number;
  /** valor médio de 1 hora extra (com adicional) */
  valorHoraExtra: number;
  /** custo de 1 hora extra cheia: vh × (1 + DSR%) × (1 + soc% + prov% + nf%) — SPEC §4.7 */
  horaExtraCheia: number;
  dsr: number;
  remun: number;
  enc: number;
  prov: number;
  nf: number;
  vtBruto: number;
  vtDesc: number;
  vt: number;
  beneficiosItem: Record<string, number>;
  benef: number;
  admissoes: number;
  desligamentos: number;
  examesTipo: { adm: number; per: number; dem: number };
  exames: number;
  resc: number;
  ferr: number;
  salFam: number;
  ferPag: number;
  sub: number;
  rl: number;
  total: number;
  /** competência menos provisões mais férias pagas (antes do deslocamento do adiantamento) */
  caixa: number;
  /** dias × pessoas presentes */
  dias: number;
  /** horas extras totais (pessoas × horas) */
  horasExtras: number;
  /** pessoas diferentes no mês */
  cabecas: number;
}

export interface OpcoesCusto {
  /** pessoa-mês no lugar do da obra (lançamento por matrícula, realocação) */
  x?: number;
  admissoes?: number;
  desligamentos?: number;
  /** multiplica as HE da obra (lançamento por matrícula) */
  multiplicadorHe?: number;
  /** soma ao absenteísmo (fração) */
  absenteismoExtra?: number;
  semVt?: boolean;
}

export function premissasDe(o: Pick<Obra, "premissas">): Premissas {
  return { ...PREMISSAS_PADRAO, ...(o.premissas ?? {}) };
}

/** Pessoa-mês total da obra no mês (todas as funções). */
export function totalMes(o: Obra, i: number): number {
  let t = 0;
  for (const v of Object.values(o.equivalente)) t += v[i] ?? 0;
  return t;
}

export function custoFuncaoMes(
  o: Obra,
  f: Funcao,
  i: number,
  pp: ParametrosObra,
  ctx: Pick<Contexto, "beneficios" | "calendario">,
  op: OpcoesCusto = {},
): CustoMes {
  const p = tabelaDoMes(pp, i);
  const est = f.vinculo === "estagio";
  const regime: RegimeCalculo = est ? "estagio" : (o.regime?.[f.id] ?? "clt");
  const clt = regime === "clt";
  const pr = premissasDe(o);
  const T = taxasEncargos(p.encargos);
  const taxa = (g: "soc" | "prov" | "nf") =>
    regime === "estagio" ? 0 : regime === "sp" ? T[g].sp : T[g].clt;

  const x = op.x ?? o.equivalente[f.id]?.[i] ?? 0;
  // alojamento e viagens: só a MO alojada (origem de cada função), decisão M11
  const fora = o.origem?.[f.id] === "aloj";
  const vtDiaria = o.vtDiariaPorFuncao?.[f.id] ?? p.vtDiaria;
  const { dsrPct, diasTrabalhados } = diasDoMes(o, i, p, ctx);
  const dsrF = dsrPct / 100;
  const { valor: s, origem: salarioOrigem } = salarioComOrigem(p, f.id);
  const a = Math.min(
    ABSENTEISMO_MAX,
    Math.max(0, (o.absenteismoPct[i] ?? 0) / 100 + (op.absenteismoExtra ?? 0)),
  );

  // §4.1 ausências (pessoa-dias da competência rateados pelo efetivo) e salário
  const parte = x / (totalMes(o, i) || 1);
  const licD = (o.licencaPessoaDias[i] ?? 0) * parte;
  const ferD = est ? 0 : (o.feriasPessoaDias[i] ?? 0) * parte;
  const xa = Math.max(0, x - (licD + ferD) / 30);
  const pres = xa * (1 - a);
  const bruto = xa * s;
  const faltasH = bruto * a;
  const faltasD = est ? 0 : faltasH * dsrF;
  const faltas = faltasH + faltasD;
  const salv = Math.max(0, bruto - faltas); // limite em zero: decisão M3
  const bolsa = est ? salv : 0;

  // §4.2 adicionais (zero para estágio)
  const adicionais: Adicionais = est
    ? { grat: 0, peric: 0, insal: 0, transf: 0, gratF: 0, not: 0, dsrNot: 0 }
    : (() => {
        const not = (((pres * f.horasNoturnasMes * s) / p.divisor) * p.adicionalNoturnoPct) / 100;
        return {
          grat: (salv * pr.gratPremiosPct) / 100,
          peric: (salv * f.periculosidadePct) / 100,
          insal: (pres * p.salarioMinimo * f.insalubridadePctSm) / 100,
          transf: pr.funcoesTransferidas.includes(f.id) ? (salv * pr.transfPct) / 100 : 0,
          gratF: xa * (p.gratificacoes[f.id] ?? 0),
          not,
          dsrNot: not * dsrF,
        };
      })();
  const extras =
    adicionais.grat +
    adicionais.peric +
    adicionais.insal +
    adicionais.transf +
    adicionais.gratF +
    adicionais.not +
    adicionais.dsrNot;

  // §4.3 horas extras por tipo
  const mix = { ...HE_MIX_PADRAO, ...(o.heMixPct ?? {}) };
  const h = est ? 0 : (o.heMedia[i] ?? 0) * f.fatorHe * (op.multiplicadorHe ?? 1);
  const vb = s / p.divisor;
  const heTipo = {} as Record<TipoHe, number>;
  let he = 0;
  for (const t of TIPOS_HE) {
    heTipo[t] = pres * h * (mix[t] / 100) * vb * (1 + p.heAdicionalPct[t] / 100);
    he += heTipo[t];
  }
  const dsr = he * dsrF;
  const valorHoraExtra = pres * h ? he / (pres * h) : vb * (1 + p.heAdicionalPct.util / 100);
  const horaExtraCheia =
    valorHoraExtra * (1 + dsrF) * (1 + taxa("soc") + taxa("prov") + taxa("nf"));

  // §4.4 encargos, VT, benefícios e demais
  const remun = salv + extras + he + dsr;
  const enc = remun * taxa("soc");
  const prov = pr.provisionar ? remun * taxa("prov") : 0;
  const nf = remun * taxa("nf");

  const comVt = regime !== "sp" && !op.semVt;
  const vtBruto = comVt ? pres * vtDiaria * diasTrabalhados : 0;
  const vtDesc = est ? 0 : Math.min(vtBruto, bruto * DESCONTO_VT);
  const vt = vtBruto - vtDesc;

  const beneficiosItem: Record<string, number> = {};
  let benef = 0;
  for (const b of ctx.beneficios) {
    if (!clt && !(est && b.id === "seguro")) continue;
    if (b.soForaSede && !fora) continue;
    const v = x * (p.beneficios[b.id] ?? 0);
    beneficiosItem[b.id] = v;
    benef += v;
  }

  const admissoes = op.admissoes ?? 0;
  const desligamentos = op.desligamentos ?? 0;
  const examesTipo = clt
    ? {
        adm: admissoes * f.exames.adm,
        per: (x * f.exames.perAnual) / 12,
        dem: desligamentos * f.exames.dem,
      }
    : { adm: 0, per: 0, dem: 0 };
  const exames = examesTipo.adm + examesTipo.per + examesTipo.dem;
  const resc = clt ? desligamentos * s * p.fatorRescisao : 0;
  const ferr = est ? 0 : pres * f.ferramentasMes;
  const salFam =
    clt && s <= p.salarioFamilia.teto ? xa * COTAS_SALARIO_FAMILIA * p.salarioFamilia.cota : 0;
  const ferPag = clt ? (ferD / 30) * s * (4 / 3) : 0;

  const sub = salv + extras + he + dsr + enc + prov + vt + benef + exames + resc + nf + ferr;
  const rl = (sub * (pr.riscoPct + pr.lucroPct + pr.tribLucroPct)) / 100;
  const total = sub + rl;
  const caixa = total - prov + ferPag * (1 + taxa("soc"));

  return {
    funcaoId: f.id,
    regime,
    x,
    xa,
    pres,
    salario: s,
    salarioOrigem,
    a,
    licD,
    ferD,
    dsrPct,
    diasTrabalhados,
    bruto,
    faltasH,
    faltasD,
    faltas,
    salv,
    bolsa,
    adicionais,
    extras,
    horasPorPessoa: h,
    heTipo,
    he,
    valorHoraExtra,
    horaExtraCheia,
    dsr,
    remun,
    enc,
    prov,
    nf,
    vtBruto,
    vtDesc,
    vt,
    beneficiosItem,
    benef,
    admissoes,
    desligamentos,
    examesTipo,
    exames,
    resc,
    ferr,
    salFam,
    ferPag,
    sub,
    rl,
    total,
    caixa,
    dias: pres * diasTrabalhados,
    horasExtras: pres * h,
    cabecas: cabecasMes(o, f.id, i),
  };
}
