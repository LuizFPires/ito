/**
 * Só para testes: carrega o motor do protótipo ITO 2.0 (docs/prototipo) em Node e converte os
 * dados de exemplo dele para o modelo do motor. É a referência da validação diferencial (M3).
 * As obras de exemplo são sintéticas (só matrícula, sem nomes de trabalhadores).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ItemEncargo } from "./encargos";
import type { Beneficio, Contexto, Funcao, Obra, ParametrosObra, Tabela } from "./modelo";

/* eslint-disable @typescript-eslint/no-explicit-any -- o protótipo é JS sem tipos */
type Qualquer = any;

export interface Prototipo {
  D: Qualquer;
  S: Qualquer;
  calc: (o: Qualquer, p: Qualquer) => Qualquer;
  custoFun: (
    o: Qualquer,
    k: string,
    i: number,
    p: Qualquer,
    mov: Qualquer,
    ov?: Qualquer,
  ) => Qualquer;
  movimentos: (o: Qualquer) => { adm: Record<string, number[]>; dem: Record<string, number[]> };
  projetar: (p: Qualquer) => Qualquer;
  pObra: (o: Qualquer) => Qualquer;
  pVig: () => Qualquer;
  pProj: (p: Qualquer) => Qualquer;
  RUBGEN: Record<string, (c: Qualquer) => number>;
  BEN: Qualquer[];
  HEF: Record<string, number>;
  HEMIX0: Record<string, number>;
}

const aqui = dirname(fileURLToPath(import.meta.url));

export function carregarPrototipo(): Prototipo {
  const html = readFileSync(join(aqui, "../../../docs/prototipo/ITO_2.0.html"), "utf8");
  const a = html.indexOf("/* ================= utilidades");
  const b = html.indexOf("/* ================= componentes visuais");
  if (a < 0 || b < 0) throw new Error("Trechos do protótipo não encontrados");
  const corpo = html.slice(a, b);
  const fn = new Function(
    "localStorage",
    `${corpo}\nreturn { D, S, calc, custoFun, movimentos, projetar, pObra, pVig, pProj, RUBGEN, BEN, HEF, HEMIX0 };`,
  );
  const P = fn({ getItem: () => null, setItem() {} }) as Prototipo;
  // decisão M11: o ITO não tem mais "obra fora da sede" (alojamento e viagens são da origem de
  // cada função, só na projeção); as obras de exemplo do protótipo rodam sem ele dos dois lados
  for (const o of P.D.obras as { prem?: { aloj?: boolean } }[]) if (o.prem) o.prem.aloj = false;
  return P;
}

// ── conversões protótipo → motor ─────────────────────────────────────────────

export function contextoDe(P: Prototipo): Contexto {
  const cal = P.D.params.cal ?? {};
  return {
    funcoes: P.D.funcoes.map((f: Qualquer) => funcaoDe(P, f)),
    beneficios: P.BEN.map((b: Qualquer): Beneficio => ({ id: b.k, soForaSede: !!b.fora })),
    calendario: {
      carnaval: !!cal.carnaval,
      corpusChristi: !!cal.corpus,
      feriadosEmpresa: (cal.extras ?? []).map((x: Qualquer) => ({ data: x.d, nome: x.n })),
    },
  };
}

export function funcaoDe(P: Prototipo, f: Qualquer): Funcao {
  const ex = f.ex ?? {
    adm: (f.exame ?? 0) * 0.5,
    per: (f.exame ?? 0) * 0.35,
    dem: (f.exame ?? 0) * 0.5,
  };
  const ad = f.adic ?? {};
  return {
    id: f.k,
    vinculo: f.vinc === "est" ? "estagio" : "clt",
    escalaArea: !!f.escala,
    exames: { adm: ex.adm ?? 0, perAnual: ex.per ?? 0, dem: ex.dem ?? 0 },
    periculosidadePct: ad.peric ?? 0,
    insalubridadePctSm: ad.insal ?? 0,
    horasNoturnasMes: ad.notH ?? 0,
    ferramentasMes: f.ferr ?? 0,
    fatorHe: P.HEF[f.k] ?? 1,
  };
}

const cacheTabela = new WeakMap<object, Tabela>();

export function tabelaDe(p: Qualquer): Tabela {
  const c = cacheTabela.get(p);
  if (c) return c;
  const t: Tabela = {
    salarios: p.sal,
    beneficios: p.ben,
    gratificacoes: p.grat ?? {},
    encargos: p.enc.map((e: Qualquer): ItemEncargo => ({
      id: e.id,
      grupo: e.g,
      nome: e.n,
      baseCalcPct: e.bc,
      aliqClt: e.f,
      aliqSp: e.s,
    })),
    heAdicionalPct: {
      util: p.heAd,
      sabado: p.heT?.sab ?? 100,
      intervalo: p.heT?.int ?? 50,
      feriado: p.heT?.fer ?? 100,
    },
    divisor: p.divisor,
    modoDias: p.diasModo === "fixo" ? "fixo" : "calendario",
    sabadoTrabalhado: !!p.sab,
    diasFixos: p.dias,
    dsrFixoPct: p.dsr,
    vtDiaria: p.vt,
    fatorRescisao: p.resc,
    salarioMinimo: p.sm ?? 0,
    adicionalNoturnoPct: p.notAd || 20,
    salarioFamilia: { teto: p.sfLim ?? 0, cota: p.sfCota ?? 0 },
  };
  cacheTabela.set(p, t);
  return t;
}

export function parametrosDe(pp: Qualquer): ParametrosObra {
  return typeof pp === "function" ? (i: number) => tabelaDe(pp(i)) : tabelaDe(pp);
}

export function obraDe(P: Prototipo, o: Qualquer): Obra {
  const pr = o.prem ?? {};
  const mix = { ...P.HEMIX0, ...(o.heMix ?? {}) };
  return {
    id: o.id ?? "nova",
    inicio: { ano: o.ini.y, mes: o.ini.m + 1 },
    area: o.area,
    equivalente: o.q,
    cabecas: o.cab,
    heMedia: o.he,
    absenteismoPct: o.abs ?? [],
    licencaPessoaDias: o.lic ?? [],
    feriasPessoaDias: o.fer ?? [],
    rotatividadePct: o.turn ?? 0,
    heMixPct: {
      util: mix.a * 100,
      sabado: mix.sab * 100,
      intervalo: mix.int * 100,
      feriado: mix.fer * 100,
    },
    regime: Object.fromEntries(
      Object.entries(o.regime ?? {}).map(([k, v]) => [k, v === "SP" ? "sp" : "clt"]),
    ),
    premissas: {
      ...(pr.extras !== undefined && { gratPremiosPct: pr.extras || 0 }),
      ...(pr.transfPct !== undefined && { transfPct: pr.transfPct || 25 }),
      ...(pr.transf !== undefined && { funcoesTransferidas: pr.transf }),
      ...(pr.risco !== undefined && { riscoPct: pr.risco || 0 }),
      ...(pr.lucro !== undefined && { lucroPct: pr.lucro || 0 }),
      ...(pr.tribLucro !== undefined && { tribLucroPct: pr.tribLucro || 0 }),
      ...(pr.provisionar !== undefined && { provisionar: pr.provisionar !== false }),
      ...(pr.adiant !== undefined && { adiantamento: !!pr.adiant }),
      ...(pr.adiantPct !== undefined && { adiantamentoPct: pr.adiantPct ?? 40 }),
    },
    feriadosMunicipais: (o.ferLoc ?? []).map((x: Qualquer) => ({ data: x.d, nome: x.n })),
    ...(o.origem && { origem: o.origem }),
    ...(o.vtDia && { vtDiariaPorFuncao: o.vtDia }),
  };
}

// ── projeção ─────────────────────────────────────────────────────────────────

export function cidadeDe(c: Qualquer) {
  return {
    id: c.id,
    tarifaLocal: c.tarifa,
    conducoes: c.cond || 1,
    passagens: Object.fromEntries(
      Object.entries((c.vtDe ?? {}) as Record<string, number>).filter(([, v]) => Number(v) > 0),
    ),
    issPct: Number(c.iss) || 0,
    feriados: (c.fer ?? []).map((f: Qualquer) => {
      const [mm, dd] = String(f.md).split("-");
      return { mes: Number(mm), dia: Number(dd), nome: f.n };
    }),
  };
}

export function cctDe(t: Qualquer) {
  return {
    mesDataBase: t.mesBase + 1,
    reajusteEstimadoPct: Number(t.reajEst) || 0,
    salarios: t.sal,
    gratificacoes: t.grat ?? {},
    beneficios: t.ben,
  };
}

export function entradaProjecaoDe(P: Prototipo, p: Qualquer, origem?: Record<string, string>) {
  const cid = p.cidade ? P.D.cidades.find((c: Qualquer) => c.id === p.cidade) : null;
  const de = P.D.cidades.find((c: Qualquer) => c.id === (p.origemCid || "bh"));
  const mix = p.heMix;
  return {
    id: p.id || "nova",
    inicio: { ano: p.ini.y, mes: p.ini.m + 1 },
    prazo: p.prazo,
    area: p.area,
    referencias: p.refs
      .map((id: string) => P.D.obras.find((o: Qualquer) => o.id === id))
      .filter(Boolean)
      .map((o: Qualquer) => obraDe(P, o)),
    estatistica: p.stat === "mediana" ? ("mediana" as const) : ("media" as const),
    ajustesPct: p.ajustes ?? {},
    quantidadesManuais: p.manual ?? null,
    heMedia: p.heOverride != null && p.heOverride !== "" ? Number(p.heOverride) : null,
    absenteismoPct: p.absP != null ? Number(p.absP) : null,
    rotatividadePct: p.turn != null ? Number(p.turn) : null,
    licencaPorPm: p.licP != null ? Number(p.licP) : null,
    feriasPorPm: p.ferP != null ? Number(p.ferP) : null,
    heMixPct: mix
      ? {
          util: mix.a * 100,
          sabado: mix.sab * 100,
          intervalo: mix.int * 100,
          feriado: mix.fer * 100,
        }
      : null,
    premissas: p.prem ? obraDe(P, { ini: p.ini, he: [], q: {}, prem: p.prem }).premissas : {},
    regime: Object.fromEntries(
      Object.entries(p.regime ?? {}).map(([k, v]) => [k, v === "SP" ? "sp" : "clt"]),
    ) as Record<string, "clt" | "sp">,
    origem: (origem ?? p.origem ?? {}) as Record<string, "local" | "diaria" | "aloj">,
    cidade: cid ? cidadeDe(cid) : null,
    cidadeOrigem: de ? cidadeDe(de) : null,
    vtDiariaReferencia: P.pVig().vt,
    feriadosMunicipais: (p.ferLoc ?? []).map((x: Qualquer) => ({ data: x.d, nome: x.n })),
  };
}
