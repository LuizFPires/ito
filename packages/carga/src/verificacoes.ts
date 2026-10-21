/**
 * Verificações da carga (PRD §3.6 etapa 5, SPEC §6). Cada item diz o estado, o que aconteceu e o
 * que fazer. `erro` bloqueia a gravação (o banco recusa de novo em `gravar_carga`).
 */
import { mesAno, moeda, numero } from "@ito/formato";
import type { Contexto, ParametrosObra, ResultadoObra } from "@ito/motor";
import { ErroEntradaMotor, anoMes, calcularObra, calendarioMes, FORA_DO_CUSTO } from "@ito/motor";
import type { Cadastro, CargaParaGravar, Escolhas, Leituras, Montagem } from "./montagem";
import { mesDaObra, rubricaDe } from "./montagem";
import type { ErroLeitura } from "./planilha";

export type EstadoVerificacao = "ok" | "aviso" | "erro";

export type IdVerificacao =
  | "leitura"
  | "resumo"
  | "ponto"
  | "funcoes"
  | "rubricas"
  | "periodo"
  | "vt"
  | "nf"
  | "lidos"
  | "calendario"
  | "realocada"
  | "erp"
  | "conferencia";

export interface Verificacao {
  id: IdVerificacao;
  estado: EstadoVerificacao;
  titulo: string;
  detalhe: string;
}

export interface MesApropriacao {
  mesIdx: number;
  ito: number;
  erp: number;
  diferenca: number;
  justificativa: string | null;
}

export interface MesConferencia {
  mesIdx: number;
  /** Σ rubricas da folha que entram no custo (descontos com sinal negativo) */
  rubricas: number;
  /** remun + resc + ferr do motor */
  custo: number;
  diferenca: number;
  confere: boolean;
}

export interface ResultadoVerificacao {
  itens: Verificacao[];
  bloqueia: boolean;
  /** payload com a apropriação × ERP preenchida */
  payload: CargaParaGravar;
  resultado: ResultadoObra | null;
  apropriacao: MesApropriacao[];
  conferencia: MesConferencia[];
  /** quem está sem VT, por mês da obra */
  semVt: { mesIdx: number; matriculas: string[] }[];
  /** NFs sem competência (ou fora do período): `cnpj|número` */
  nfSemMes: { chave: string; numero: string; arquivo: string }[];
  /** obras escritas na folha como destino de MDO realocada */
  destinosRealocada: { texto: string; matriculas: number }[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const lista = (xs: readonly string[], max = 6) =>
  xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} e mais ${xs.length - max}`;
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
const errosDe = (e: readonly ErroLeitura[]) =>
  lista(
    e.map((x) => (x.linha ? `${x.aba}, linha ${x.linha}: ${x.mensagem}` : x.mensagem)),
    4,
  );

export function verificarCarga(
  m: Montagem,
  leituras: Leituras,
  escolhas: Escolhas,
  cadastro: Cadastro,
  ctx: Contexto,
  parametros: ParametrosObra,
): ResultadoVerificacao {
  const { obra, payload } = m;
  const N = obra.meses!;
  const nomeMes = (i: number) => {
    const { ano, mes } = anoMes(obra.inicio, i);
    return mesAno(ano, mes);
  };
  const itens: Verificacao[] = [];
  const add = (v: Verificacao) => itens.push(v);

  // 1. leitura dos arquivos
  const errosFolha = leituras.folha.erros;
  if (errosFolha.length)
    add({
      id: "leitura",
      estado: "erro",
      titulo: `${plural(errosFolha.length, "erro", "erros")} na leitura da folha`,
      detalhe: `${errosDe(errosFolha)}. Corrija o arquivo e envie de novo.`,
    });

  // 2. proventos × resumo da folha
  const proventos = Array<number>(N).fill(0);
  for (const l of payload.lancamentos)
    for (const r of l.rubricas)
      if (rubricaDe(r.codigo, cadastro, escolhas)?.tipo === "provento")
        proventos[l.mes_idx]! += r.valor;
  const resumo = leituras.folha.resumo;
  if (!resumo.length)
    add({
      id: "resumo",
      estado: "aviso",
      titulo: "Folha sem resumo",
      detalhe: "Sem a aba Resumo, o total de proventos lido não é conferido com a folha.",
    });
  else {
    const difs: string[] = [];
    for (const s of resumo) {
      const i = mesDaObra(obra.inicio, s.comp);
      if (i < 0 || i >= N) continue;
      const d = r2(proventos[i]! - s.proventos);
      if (Math.abs(d) >= 1) difs.push(`${nomeMes(i)} (${moeda(d)})`);
    }
    add(
      difs.length
        ? {
            id: "resumo",
            estado: "erro",
            titulo: "Total de proventos não bate com o resumo da folha",
            detalhe: `Diferença em ${lista(difs)}. Confira se a folha veio completa (todas as matrículas e rubricas).`,
          }
        : {
            id: "resumo",
            estado: "ok",
            titulo: "Total de proventos confere com o resumo da folha",
            detalhe: `Soma por competência bate com o resumo em ${plural(resumo.length, "mês", "meses")}.`,
          },
    );
  }

  // 3. ponto × folha
  if (!leituras.ponto)
    add({
      id: "ponto",
      estado: "aviso",
      titulo: "Sem cartão de ponto",
      detalhe: "Horas extras e faltas serão lidas só da folha, sem conferência.",
    });
  else {
    const he = Array<number>(N).fill(0);
    const fa = Array<number>(N).fill(0);
    for (const p of leituras.ponto) {
      const i = mesDaObra(obra.inicio, p.comp);
      if (i < 0 || i >= N) continue;
      he[i]! += p.he;
      fa[i]! += p.faltas;
    }
    const heF = Array<number>(N).fill(0);
    const faF = Array<number>(N).fill(0);
    for (const l of payload.lancamentos) {
      heF[l.mes_idx]! += l.horas_extras;
      faF[l.mes_idx]! += l.faltas_horas;
    }
    const fora = (a: number, b: number) => Math.abs(a - b) > Math.max(0.01 * Math.max(a, b), 0.5);
    const meses = Array.from({ length: N }, (_, i) => i).filter(
      (i) => fora(he[i]!, heF[i]!) || fora(fa[i]!, faF[i]!),
    );
    add(
      meses.length
        ? {
            id: "ponto",
            estado: "aviso",
            titulo: "Ponto e folha diferem em horas extras ou faltas",
            detalhe: `Diferença acima de 1% em ${lista(
              meses.map((i) => `${nomeMes(i)} (HE ${numero(he[i]!, 1)} × ${numero(heF[i]!, 1)} h)`),
            )}. Valem as horas pagas na folha.`,
          }
        : {
            id: "ponto",
            estado: "ok",
            titulo: "Horas extras e faltas do ponto conferem com a folha",
            detalhe: "Diferença abaixo de 1% entre horas apuradas e horas pagas em todos os meses.",
          },
    );
  }

  // 4–6. pendências bloqueantes
  const pf = m.pendencias.funcoes;
  add(
    pf.length
      ? {
          id: "funcoes",
          estado: "erro",
          titulo: `${plural(pf.length, "função", "funções")} da folha sem correspondência`,
          detalhe: `${lista(pf.map((f) => `“${f.texto.toLowerCase()}”`))}: escolha a função padrão ou crie uma nova na etapa Funções.`,
        }
      : {
          id: "funcoes",
          estado: "ok",
          titulo: "Todas as funções da folha têm função padrão",
          detalhe: "Inclui mão de obra indireta e administrativa.",
        },
  );
  const pr = m.pendencias.rubricas;
  add(
    pr.length
      ? {
          id: "rubricas",
          estado: "erro",
          titulo: `${plural(pr.length, "rubrica nova", "rubricas novas")} sem classificação`,
          detalhe: `${lista(pr.map((r) => `${r.codigo} · ${r.descricao.toLowerCase() || "sem descrição"}`))}: defina tipo e como entra no custo na etapa Rubricas.`,
        }
      : {
          id: "rubricas",
          estado: "ok",
          titulo: "Todas as rubricas da folha estão classificadas",
          detalhe:
            "Proventos, descontos e informativos separados; descontos do empregado ficam fora do custo.",
        },
  );
  if (m.pendencias.foraDoPeriodo.length)
    add({
      id: "periodo",
      estado: "erro",
      titulo: "Folha com competência fora do período da obra",
      detalhe: `${lista(m.pendencias.foraDoPeriodo.map((c) => mesAno(c.ano, c.mes)))}: ajuste início e fim da obra na etapa Obra.`,
    });

  // 7. VT ausente
  const semVt: { mesIdx: number; matriculas: string[] }[] = [];
  if (!leituras.vt)
    add({
      id: "vt",
      estado: "aviso",
      titulo: "Sem arquivo de vale-transporte",
      detalhe: "O VT desta obra não será conferido por matrícula.",
    });
  else {
    const estagio = new Set(ctx.funcoes.filter((f) => f.vinculo === "estagio").map((f) => f.id));
    for (let i = 0; i < N; i++) {
      const ms = payload.lancamentos
        .filter(
          (l) =>
            l.mes_idx === i &&
            !l.realocada_para &&
            l.vt_valor === null &&
            !estagio.has(l.funcao_id),
        )
        .map((l) => l.matricula);
      if (ms.length) semVt.push({ mesIdx: i, matriculas: [...new Set(ms)] });
    }
    const total = semVt.reduce((s, x) => s + x.matriculas.length, 0);
    add(
      !total
        ? {
            id: "vt",
            estado: "ok",
            titulo: "Todos os trabalhadores têm vale-transporte",
            detalhe: "Cada matrícula da folha tem crédito de VT no mês.",
          }
        : {
            id: "vt",
            estado: escolhas.semVtConfirmado ? "ok" : "aviso",
            titulo: `${plural(total, "lançamento", "lançamentos")} sem vale-transporte`,
            detalhe: `${lista(
              semVt.map((s) => `${nomeMes(s.mesIdx)}: ${lista(s.matriculas, 3)}`),
              3,
            )}. ${
              escolhas.semVtConfirmado
                ? "Confirmado: optaram por não receber."
                : "Podem ter optado por não receber VT ou o lançamento está faltando."
            }`,
          },
    );
  }

  // 8. NF sem competência
  const notas = leituras.notas ?? [];
  const nfSemMes = payload.notas
    .filter((n) => n.mes_idx === null)
    .map((n) => ({
      chave: `${n.prestador_cnpj}|${n.numero}`,
      numero: n.numero,
      arquivo:
        notas.find((x) => x.numero === n.numero && x.prestadorCnpj === n.prestador_cnpj)?.arquivo ??
        "",
    }));
  add(
    !notas.length
      ? {
          id: "nf",
          estado: "aviso",
          titulo: "Notas fiscais de prestadores não enviadas",
          detalhe: "Tributos sobre NF ficarão sem conferência nesta obra.",
        }
      : nfSemMes.length
        ? {
            id: "nf",
            estado: "erro",
            titulo: `${plural(nfSemMes.length, "nota fiscal", "notas fiscais")} sem competência`,
            detalhe: `${lista(nfSemMes.map((n) => `NF ${n.numero}`))}: o XML não traz o mês (ou ele está fora da obra). Escolha a competência.`,
          }
        : {
            id: "nf",
            estado: "ok",
            titulo: `${plural(notas.length, "nota fiscal lida", "notas fiscais lidas")}`,
            detalhe: "Todas com competência dentro do período da obra.",
          },
  );

  // 9. itens lidos
  const matriculas = new Set(payload.lancamentos.map((l) => l.matricula)).size;
  const rubs = new Set(payload.lancamentos.flatMap((l) => l.rubricas.map((r) => r.codigo))).size;
  const heT = m.heHorasPorTipo;
  add({
    id: "lidos",
    estado: m.semAbaPessoas ? "aviso" : "ok",
    titulo: "Lidos da folha por competência",
    detalhe: `${plural(N, "competência", "competências")} · ${plural(payload.lancamentos.length, "lançamento", "lançamentos")} · ${plural(matriculas, "matrícula", "matrículas")} · ${plural(rubs, "rubrica", "rubricas")}. HE: ${numero(heT.util, 1)} h úteis, ${numero(heT.sabado, 1)} h sábado, ${numero(heT.intervalo, 1)} h intervalo, ${numero(heT.feriado, 1)} h domingos e feriados.${
      m.semAbaPessoas
        ? " Sem a aba Pessoas: cada matrícula conta 1 pessoa-mês, sem faltas, licenças, férias nem movimentação."
        : ""
    }`,
  });

  // 10. calendário
  let ferUteis = 0;
  for (let i = 0; i < N; i++) {
    const { ano, mes } = anoMes(obra.inicio, i);
    ferUteis += calendarioMes(
      ano,
      mes,
      ctx.calendario,
      obra.feriadosMunicipais ?? [],
    ).feriadosUteis;
  }
  add({
    id: "calendario",
    estado: "ok",
    titulo: `Calendário do período: ${plural(ferUteis, "feriado", "feriados")} em dias úteis`,
    detalhe: `DSR e dias úteis de cada mês pelo calendário (nacionais, da empresa${
      obra.feriadosMunicipais?.length
        ? ` e ${plural(obra.feriadosMunicipais.length, "municipal", "municipais")}`
        : ""
    }).`,
  });

  // 11. MDO realocada
  const destinos = new Map<string, Set<string>>();
  for (const p of leituras.folha.pessoas)
    if (p.obra) {
      if (!destinos.has(p.obra)) destinos.set(p.obra, new Set());
      destinos.get(p.obra)!.add(p.matricula);
    }
  const destinosRealocada = [...destinos].map(([texto, ms]) => ({ texto, matriculas: ms.size }));
  if (destinosRealocada.length) {
    const semEscolha = destinosRealocada.filter((d) => !escolhas.realocacao[d.texto]);
    const n = destinosRealocada.reduce((s, d) => s + d.matriculas, 0);
    add({
      id: "realocada",
      estado: semEscolha.length ? "aviso" : "ok",
      titulo: `${plural(n, "trabalhador marcado", "trabalhadores marcados")} como MDO realocada`,
      detalhe: `Estão na folha desta obra mas trabalharam em ${lista(destinosRealocada.map((d) => `“${d.texto}”`))}. O custo sai desta obra e o saldo de VT vai junto.${
        semEscolha.length ? " Escolha a obra de destino." : ""
      }`,
    });
  }

  // cálculo do motor (apropriação e conferência)
  let resultado: ResultadoObra | null = null;
  try {
    resultado = calcularObra(obra, parametros, ctx, { movimentos: m.movimentos });
  } catch (e) {
    if (!(e instanceof ErroEntradaMotor)) throw e;
    add({
      id: "conferencia",
      estado: "erro",
      titulo: "A obra não pôde ser calculada",
      detalhe: e.message,
    });
  }

  // 12. apropriação × ERP (SPEC §6.2): caixa do ITO × realizado no ERP, por mês
  const apropriacao: MesApropriacao[] = [];
  const erp = payload.erp;
  const competencias = payload.competencias.map((c) => ({ ...c }));
  if (!leituras.erp)
    add({
      id: "erp",
      estado: "aviso",
      titulo: "Sem relatório do ERP",
      detalhe: "A apropriação desta obra não será conferida com o realizado.",
    });
  else if (resultado) {
    for (let i = 0; i < N; i++) {
      const ito = r2(resultado.porMes[i]!.caixa);
      const real = r2(erp.filter((e) => e.mes_idx === i).reduce((s, e) => s + e.valor, 0));
      const justificativa = escolhas.justificativas[i] || null;
      apropriacao.push({ mesIdx: i, ito, erp: real, diferenca: r2(real - ito), justificativa });
      Object.assign(competencias[i]!, {
        ito_apropriado: ito,
        erp_realizado: real,
        justificativa,
      });
    }
    const abertas = apropriacao.filter((a) => Math.abs(a.diferenca) >= 1 && !a.justificativa);
    const difs = apropriacao.filter((a) => Math.abs(a.diferenca) >= 1);
    add(
      abertas.length
        ? {
            id: "erp",
            estado: "erro",
            titulo: `Apropriação × ERP: diferença sem justificativa em ${plural(abertas.length, "mês", "meses")}`,
            detalhe: `${lista(abertas.map((a) => `${nomeMes(a.mesIdx)} (${moeda(a.diferenca)})`))}. Justifique cada diferença.`,
          }
        : {
            id: "erp",
            estado: "ok",
            titulo: difs.length
              ? `Apropriação × ERP: ${plural(difs.length, "diferença justificada", "diferenças justificadas")}`
              : "Apropriação × ERP confere em todos os meses",
            detalhe: "Caixa apropriado pelo ITO contra o realizado no ERP, mês a mês.",
          },
    );
  }

  // 13. conferência rubricas × custo (SPEC §6.1), com os valores reais da folha
  const conferencia: MesConferencia[] = [];
  if (resultado) {
    const rub = Array<number>(N).fill(0);
    for (const l of payload.lancamentos) {
      if (l.realocada_para) continue;
      for (const r of l.rubricas) {
        const c = rubricaDe(r.codigo, cadastro, escolhas);
        if (!c || FORA_DO_CUSTO.includes(c.componente)) continue;
        rub[l.mes_idx]! += c.tipo === "desconto" ? -Math.abs(r.valor) : r.valor;
      }
    }
    for (let i = 0; i < N; i++) {
      const s = resultado.porMes[i]!;
      const custo = r2(s.remun + s.resc + s.ferr);
      const diferenca = r2(rub[i]! - custo);
      conferencia.push({
        mesIdx: i,
        rubricas: r2(rub[i]!),
        custo,
        diferenca,
        confere: Math.abs(diferenca) < 1,
      });
    }
    const dif = conferencia.filter((c) => !c.confere);
    add(
      dif.length
        ? {
            id: "conferencia",
            estado: "aviso",
            titulo: `Conferência rubricas × custo: diferença em ${plural(dif.length, "mês", "meses")}`,
            detalhe: `${lista(dif.map((c) => `${nomeMes(c.mesIdx)} (${moeda(c.diferenca)})`))}. O custo do ITO (tabela da época) não reproduz a folha nesses meses.`,
          }
        : {
            id: "conferencia",
            estado: "ok",
            titulo: "Conferência rubricas × custo: Confere em todos os meses",
            detalhe:
              "Rubricas que entram no custo = remuneração + rescisões + ferramentas, com tolerância de R$ 1.",
          },
    );
  }

  return {
    itens,
    bloqueia: itens.some((v) => v.estado === "erro"),
    payload: { ...payload, competencias },
    resultado,
    apropriacao,
    conferencia,
    semVt,
    nfSemMes,
    destinosRealocada,
  };
}
