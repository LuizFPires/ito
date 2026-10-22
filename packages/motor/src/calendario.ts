/**
 * Calendário (SPEC §2): feriados nacionais, móveis (Páscoa), da empresa e municipais;
 * dias úteis, repousos e DSR% de cada mês.
 * Datas como texto ISO "aaaa-mm-dd" e contas em UTC, para não depender do fuso da máquina.
 */

export type TipoFeriado = "nacional" | "facultativo" | "empresa" | "municipal";

export interface Feriado {
  data: string;
  nome: string;
}

export interface FeriadoTipado extends Feriado {
  tipo: TipoFeriado;
}

export interface OpcoesCalendario {
  /** Segunda e terça de Carnaval (P−48, P−47). Padrão: desligado. */
  carnaval: boolean;
  /** Corpus Christi (P+60). Padrão: ligado. */
  corpusChristi: boolean;
  /** Feriados da empresa (Parâmetros), com data completa. */
  feriadosEmpresa: readonly Feriado[];
}

const NACIONAIS: readonly [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["12-25", "Natal"],
];

const dois = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
const somaDias = (isoData: string, n: number) => {
  const d = new Date(`${isoData}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** Domingo de Páscoa (algoritmo de Meeus/Butcher), em ISO. */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** Feriados do ano: nacionais, móveis conforme as opções e os da empresa. Em ordem de data. */
export function feriadosDoAno(ano: number, opcoes: OpcoesCalendario): FeriadoTipado[] {
  const lista: FeriadoTipado[] = NACIONAIS.map(([md, nome]) => ({
    data: `${ano}-${md}`,
    nome,
    tipo: "nacional",
  }));
  if (ano >= 2024) {
    lista.push({ data: `${ano}-11-20`, nome: "Dia da Consciência Negra", tipo: "nacional" });
  }
  const p = pascoa(ano);
  lista.push({ data: somaDias(p, -2), nome: "Sexta-feira Santa", tipo: "nacional" });
  if (opcoes.carnaval) {
    lista.push({ data: somaDias(p, -48), nome: "Carnaval (segunda)", tipo: "facultativo" });
    lista.push({ data: somaDias(p, -47), nome: "Carnaval (terça)", tipo: "facultativo" });
  }
  if (opcoes.corpusChristi) {
    lista.push({ data: somaDias(p, 60), nome: "Corpus Christi", tipo: "facultativo" });
  }
  for (const f of opcoes.feriadosEmpresa) {
    if (f.data.startsWith(`${ano}-`)) lista.push({ ...f, tipo: "empresa" });
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

export interface CalendarioMes {
  ano: number;
  /** 1 a 12 */
  mes: number;
  dias: number;
  /** segunda a sexta úteis */
  seg: number;
  /** sábados úteis */
  sab: number;
  /** domingos + feriados em dia útil */
  rep: number;
  feriadosUteis: number;
  uteis: number;
  /** DSR% = rep ÷ úteis × 100 */
  dsrPct: number;
  /** feriados que caem no mês (todos, inclusive em domingo) */
  feriados: FeriadoTipado[];
}

/** Dias e repousos de um mês, com feriados nacionais, da empresa e municipais. */
export function calendarioMes(
  ano: number,
  mes: number,
  opcoes: OpcoesCalendario,
  municipais: readonly Feriado[] = [],
): CalendarioMes {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`Mês inválido: ${mes}. Use 1 a 12.`);
  }
  const prefixo = `${ano}-${dois(mes)}-`;
  const feriados = [
    ...feriadosDoAno(ano, opcoes),
    ...municipais.map((f) => ({ ...f, tipo: "municipal" as const })),
  ]
    .filter((f) => f.data.startsWith(prefixo))
    // mesma data duas vezes (ex.: municipal = nacional): fica a primeira (nacional antes)
    .filter((f, i, todos) => todos.findIndex((g) => g.data === f.data) === i)
    .sort((x, y) => x.data.localeCompare(y.data));
  const datas = new Set(feriados.map((f) => f.data));

  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let seg = 0;
  let sab = 0;
  let rep = 0;
  let feriadosUteis = 0;
  for (let d = 1; d <= dias; d++) {
    const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (semana === 0) rep++;
    else if (datas.has(`${prefixo}${dois(d)}`)) {
      rep++;
      feriadosUteis++;
    } else if (semana === 6) sab++;
    else seg++;
  }
  const uteis = seg + sab;
  if (uteis === 0) {
    throw new RangeError(
      `${dois(mes)}/${ano} ficou sem dias úteis. Confira os feriados cadastrados para esse mês.`,
    );
  }
  return {
    ano,
    mes,
    dias,
    seg,
    sab,
    rep,
    feriadosUteis,
    uteis,
    dsrPct: (rep / uteis) * 100,
    feriados,
  };
}

export interface RegraDias {
  modoDias: "calendario" | "fixo";
  sabadoTrabalhado: boolean;
  diasFixos: number;
  /** 0 a 100 */
  dsrFixoPct: number;
}

/** Dias trabalhados e DSR (fração) do mês, conforme a tabela da empresa. */
export function diasEDsr(
  cal: CalendarioMes,
  regra: RegraDias,
): { diasTrabalhados: number; dsr: number } {
  if (regra.modoDias === "fixo") {
    return { diasTrabalhados: regra.diasFixos, dsr: regra.dsrFixoPct / 100 };
  }
  return {
    diasTrabalhados: cal.seg + (regra.sabadoTrabalhado ? cal.sab : 0),
    dsr: cal.rep / cal.uteis,
  };
}
