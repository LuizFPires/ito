/**
 * Projeção para .xlsx (M8): premissas, efetivo, custo por função e por componente, quanto custa
 * trazer gente de fora e projeção × referências. Mesmos números da tela, preços da cidade.
 */
import { mesAno, moeda, numero, percentual } from "@ito/formato";
import type { Cenario, CustoMes, Reajuste, Soma } from "@ito/motor";
import { PREMISSAS_PADRAO, TIPOS_HE } from "@ito/motor";
import type { Calculo, Entradas } from "../../lib/projecaoDoBanco";
import type { Tabela } from "../../lib/planilha";
import type { FuncaoInfo } from "../obra/comum";
import { NOME_HE } from "../obra/comum";
import { tabelaCustoComponente, tabelaCustoFuncao, tabelaEfetivo } from "../obra/exportar";
import type { InfoFuncao } from "./funcoes";
import { descreverBase, rotulosMeses } from "./projecoes";

export interface ReferenciaExportada {
  nome: string;
  area: number;
  meses: number;
  pico: number;
  pessoaMes: number;
  custo: number;
}

export interface DadosExportacao {
  e: Entradas;
  calc: Calculo;
  ids: readonly string[];
  fun: (id: string) => InfoFuncao;
  cidade: string | null;
  cct: string | null;
  origem: string | null;
  vigente: number;
  situacao?: string;
  caixa: boolean;
  cenarios: readonly Cenario[];
  referencias: readonly ReferenciaExportada[];
}

const NOME_CENARIO: Record<Cenario["nome"], string> = {
  planejado: "Como planejado",
  local: "Toda a mão de obra local",
  diaria: "Toda vindo de fora todo dia",
  aloj: "Toda alojada",
};

/** Reajustes no prazo, como a tela e o PDF mostram (vários = compostos, cada um com o mês). */
export function textoReajustes(reajustes: readonly Reajuste[], rotulos: readonly string[]): string {
  if (!reajustes.length) return "Sem reajuste no prazo";
  const origem = reajustes[0]!.automatico ? "data-base da CCT" : "informado";
  return `Reajuste de ${reajustes
    .map((x) => `${percentual(x.pct, 1)} em ${rotulos[x.mesIdx] ?? ""}`)
    .join(" e ")} (${origem}${reajustes.length > 1 ? ", composto" : ""})`;
}

export function titulosProjecao(d: Pick<DadosExportacao, "e" | "cidade" | "vigente">): string[] {
  const { e } = d;
  return [
    e.nome || "Projeção",
    [e.cliente || "Sem cliente", e.tipologia, d.cidade, `${numero(e.area)} m²`]
      .filter(Boolean)
      .join(" · "),
    `${numero(e.prazo)} meses a partir de ${mesAno(e.inicio.ano, e.inicio.mes)} · preços de ${d.vigente}`,
  ];
}

export function tabelasDaProjecao(d: DadosExportacao): Tabela[] {
  const { e, calc, ids } = d;
  const r = calc.r!;
  const R = r.resultado;
  const rotulos = rotulosMeses(e.inicio, e.prazo);
  const fun = (k: string): FuncaoInfo => ({ ...d.fun(k), conta: "" });
  const V = (c: CustoMes | Soma) => (d.caixa ? c.caixa : c.total);
  const t = titulosProjecao(d);
  const tv = [...t, d.caixa ? "Visão caixa" : "Visão competência (com provisões)"];
  const pr = { ...PREMISSAS_PADRAO, ...e.premissas };
  const a = r.aplicadas;
  const premissas: [string, string][] = [
    ["Projeção", e.nome],
    ["Situação", d.situacao ?? "Rascunho"],
    ["Cliente", e.cliente || "Sem cliente"],
    ["Tipologia", e.tipologia || "—"],
    ["Cidade", d.cidade ?? "Sem cidade (tabela da empresa)"],
    ["CCT", d.cct ?? "—"],
    ["Início", mesAno(e.inicio.ano, e.inicio.mes)],
    ["Prazo", `${numero(e.prazo)} meses`],
    ["Área", `${numero(e.area)} m²`],
    [
      "Base",
      descreverBase({
        referencias: e.referencias,
        estatistica: e.estatistica,
        quantidades_manuais: e.quantidadesManuais,
        prazo_meses: e.prazo,
      }),
    ],
    ["Horas extras", `${numero(a.heMedia, 1)} h por pessoa·mês`],
    ...TIPOS_HE.map((k): [string, string] => [NOME_HE[k], percentual(a.heMixPct[k], 0)]),
    ["Absenteísmo", percentual(a.absenteismoPct)],
    ["Rotatividade", `${percentual(a.rotatividadePct, 1)} a.m.`],
    ["Licenças sem remuneração", `${numero(a.licencaPorPm, 2)} dias por pessoa·mês`],
    ["Férias gozadas na obra", `${numero(a.feriasPorPm, 2)} dias por pessoa·mês`],
    ["Gratificações e prêmios", percentual(pr.gratPremiosPct, 1)],
    [
      "Risco · lucro · tributos s/ lucro",
      `${percentual(pr.riscoPct, 1)} · ${percentual(pr.lucroPct, 1)} · ${percentual(pr.tribLucroPct, 1)}`,
    ],
    ["Provisões", pr.provisionar ? "Sim (competência)" : "Não"],
    ["Reajustes", textoReajustes(calc.reajustes, rotulos)],
    ["Quem vem todo dia sai de", d.origem ?? "—"],
    ["Custo total", moeda(r.total)],
    ["Pico de efetivo", `${numero(r.pico)} pessoas`],
    ["Pessoa-mês", numero(r.pessoaMes, 1)],
  ];
  const tabelas: Tabela[] = [
    {
      aba: "Premissas",
      titulo: t,
      colunas: [
        { titulo: "Item", formato: "texto", largura: 34 },
        { titulo: "Valor", formato: "texto", largura: 60 },
      ],
      linhas: premissas,
    },
    tabelaEfetivo(r.obra, ids, fun, rotulos, t),
    tabelaCustoFuncao(R, ids, fun, rotulos, V, tv),
    tabelaCustoComponente(R, ids, rotulos, V, d.caixa, tv),
  ];
  if (d.cenarios.length) {
    const b = d.cenarios[0]!.total;
    tabelas.push({
      aba: "Trazer gente de fora",
      titulo: [...t, "Mesmo histograma e mesma CCT; muda só a origem da mão de obra"],
      colunas: [
        { titulo: "Cenário", formato: "texto", largura: 34 },
        { titulo: "Vale-transporte", formato: "moeda", largura: 16 },
        { titulo: "Benefícios", formato: "moeda", largura: 16 },
        { titulo: "Custo total", formato: "moeda", largura: 16 },
        { titulo: "Diferença", formato: "moeda", largura: 16 },
        { titulo: "Diferença %", formato: "pct" },
      ],
      linhas: d.cenarios.map((c, j) => [
        c.nome === "diaria" && d.origem
          ? `Toda vindo de ${d.origem} todo dia`
          : NOME_CENARIO[c.nome],
        c.vt,
        c.benef,
        c.total,
        j === 0 ? null : c.total - b,
        j === 0 || !b ? null : (c.total / b - 1) * 100,
      ]),
    });
  }
  tabelas.push({
    aba: "Projeção × referências",
    titulo: [...t, `Tudo a valores de ${d.vigente}`],
    colunas: [
      { titulo: "Obra", formato: "texto", largura: 32 },
      { titulo: "Área (m²)", formato: "inteiro" },
      { titulo: "Prazo (meses)", formato: "inteiro" },
      { titulo: "Pico", formato: "pm" },
      { titulo: "PM / 1.000 m²", formato: "pm" },
      { titulo: "Custo", formato: "moeda", largura: 16 },
      { titulo: "R$ / m²", formato: "moeda" },
    ],
    linhas: [
      ...d.referencias.map((x) => [
        x.nome,
        x.area,
        x.meses,
        x.pico,
        x.area ? (x.pessoaMes / x.area) * 1000 : null,
        x.custo,
        x.area ? x.custo / x.area : null,
      ]),
      [
        e.nome || "Esta projeção",
        e.area,
        e.prazo,
        r.pico,
        e.area ? (r.pessoaMes / e.area) * 1000 : null,
        r.total,
        e.area ? r.total / e.area : null,
      ],
    ],
    total: true,
  });
  return tabelas;
}
