import { describe, expect, it } from "vitest";
import { calcularObra } from "@ito/motor";
import { CADASTRO, CTX, DADOS, FOLHA, PES, RUB, TABELA } from "./fixtures";
import { lerFolha } from "./leitores";
import type { Escolhas } from "./montagem";
import { ESCOLHAS_VAZIAS, montarCarga, periodoDaFolha } from "./montagem";

describe("montagem da obra a partir da folha", () => {
  const m = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);

  it("período sai da folha", () => {
    expect(FOLHA.erros).toEqual([]);
    expect(periodoDaFolha(FOLHA)).toEqual({ inicio: { ano: 2025, mes: 3 }, meses: 2 });
  });

  it("mapeia pelo nome e pelo sinônimo; rubrica nova fica pendente", () => {
    expect(m.pendencias.funcoes).toEqual([]);
    expect(m.pendencias.rubricas).toEqual([{ codigo: 7777, descricao: "PRÊMIO ASSIDUIDADE" }]);
  });

  it("pessoa-mês por dias de vínculo; MDO realocada fora do efetivo", () => {
    expect(m.obra.equivalente.ped).toEqual([1, 1.5]);
    expect(m.obra.equivalente.serv).toEqual([1, 0]);
    expect(m.obra.cabecas!.ped).toEqual([1, 2]);
    expect(m.movimentos.admissoes.ped).toEqual([1, 1]);
    expect(m.movimentos.desligamentos.ped).toEqual([0, 1]);
  });

  it("absenteísmo e HE média são as inversas das fórmulas do motor", () => {
    // mar: 11 h ÷ (2 pessoa-mês × 220) = 2,5%; HE 15 h ÷ (0,975 × 1,1 + 0,975 × 0,9) = 7,6923
    expect(m.obra.absenteismoPct).toEqual([2.5, 0]);
    expect(m.obra.heMedia[0]).toBeCloseTo(15 / 1.95, 4);
    expect(m.obra.heMedia[1]).toBe(0);
  });

  it("ida e volta: o motor, com a obra montada, reproduz as horas extras pagas", () => {
    const r = calcularObra(m.obra, TABELA, CTX, { movimentos: m.movimentos });
    expect(r.porMes[0]!.horasExtras).toBeCloseTo(15, 3);
    expect(r.porMes[0]!.admissoes).toBe(1);
  });

  it("mix de HE pelas horas de cada tipo e rotatividade pela troca de gente", () => {
    expect(m.obra.heMixPct).toEqual({ util: 66.6667, sabado: 33.3333, intervalo: 0, feriado: 0 });
    // abr: 1 admitido e 1 desligado entre 2 cabeças = 50%
    expect(m.obra.rotatividadePct).toBe(50);
  });

  it("realocação agrupada por obra de destino e função", () => {
    expect(m.payload.realocacoes).toEqual([
      {
        tipo: "cedida",
        funcao_id: "serv",
        mes_ini: 1,
        mes_fim: 1,
        qtd: 1,
        outra_obra: "OBRA B",
        outra_obra_id: null,
        saldo_vt: 0,
      },
    ]);
    expect(m.payload.lancamentos.filter((l) => l.realocada_para)).toHaveLength(1);
  });

  it("payload: lançamentos com rubricas, período e premissas lidas", () => {
    expect(m.payload.lancamentos).toHaveLength(5);
    const l = m.payload.lancamentos.find((x) => x.mes_idx === 0 && x.matricula === "1001")!;
    expect(l).toMatchObject({ equivalente: 1, horas_extras: 15, faltas_horas: 11, admitido: true });
    expect(l.rubricas).toHaveLength(3);
    expect(m.payload.obra).toMatchObject({ inicio: "2025-03-01", meses: 2, rotatividade_pct: 50 });
  });

  it("escolhas: rubrica classificada e função mapeada viram cadastro na gravação", () => {
    const e: Escolhas = {
      ...ESCOLHAS_VAZIAS,
      funcoes: { PEDREIRO: "ped" },
      rubricasNovas: {
        7777: {
          nome: "PRÊMIO ASSIDUIDADE",
          tipo: "provento",
          componente: "extras",
          baseProvisoes: true,
          tipoHe: null,
        },
      },
    };
    const m2 = montarCarga(DADOS, { folha: FOLHA }, CADASTRO, e, TABELA);
    expect(m2.pendencias.rubricas).toEqual([]);
    expect(m2.payload.rubricas_novas.map((r) => r.codigo)).toEqual([7777]);
    expect(m2.payload.sinonimos).toEqual([{ texto: "PEDREIRO", funcao_id: "ped" }]);
  });

  it("função sem correspondência e competência fora do período ficam pendentes", () => {
    const f2 = lerFolha({ Rubricas: [RUB, ["05/2025", 9, "AJUDANTE GERAL", 1, "", 220, 1]] });
    const m3 = montarCarga(DADOS, { folha: f2 }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    expect(m3.pendencias.funcoes).toEqual([{ texto: "AJUDANTE GERAL", matriculas: 1 }]);
    const f3 = lerFolha({ Rubricas: [RUB, ["05/2025", 9, "PEDREIRO", 1, "", 220, 1]] });
    const m4 = montarCarga(DADOS, { folha: f3 }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    expect(m4.pendencias.foraDoPeriodo).toEqual([{ ano: 2025, mes: 5 }]);
  });
});

describe("casos da revisão do M4", () => {
  const mar = { ano: 2025, mes: 3 };

  it("rubrica paga depois da saída (sem linha em Pessoas) não infla pessoa-mês nem cabeças", () => {
    const f = lerFolha({
      Rubricas: [
        RUB,
        ["03/2025", 1001, "PEDREIRO", 1, "", 220, 1650],
        ["04/2025", 1001, "PEDREIRO", 29, "FÉRIAS PROPORCIONAIS", 0, 300],
        ["04/2025", 1002, "PEDREIRO", 1, "", 220, 1650],
      ],
      Pessoas: [
        PES,
        ["03/2025", 1001, "PEDREIRO", "", "", "S", 0, 0, 0, ""],
        ["04/2025", 1002, "PEDREIRO", "", "S", "", 0, 0, 0, ""],
      ],
    });
    const m = montarCarga(DADOS, { folha: f }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    expect(m.obra.equivalente.ped).toEqual([1, 1]);
    expect(m.obra.cabecas!.ped).toEqual([1, 1]);
    expect(m.semPessoa).toEqual([{ mesIdx: 1, matricula: "1001" }]);
  });

  it("dois textos da folha na mesma função e matrícula no mês: soma dias, faltas e rubricas", () => {
    const f = lerFolha({
      Rubricas: [
        RUB,
        ["03/2025", 7, "SERVENTE", 1, "", 110, 550],
        ["03/2025", 7, "SERVENTE DE OBRAS", 1, "", 110, 550],
      ],
      Pessoas: [
        PES,
        ["03/2025", 7, "SERVENTE", 15, "S", "", 4, 0, 0, ""],
        ["03/2025", 7, "SERVENTE DE OBRAS", 16, "", "", 0, 0, 0, ""],
      ],
    });
    const m = montarCarga(DADOS, { folha: f }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    const l = m.payload.lancamentos.filter((x) => x.matricula === "7");
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ equivalente: 1, faltas_horas: 4, admitido: true });
    expect(l[0]!.rubricas).toEqual([{ codigo: 1, referencia: 220, valor: 1100 }]);
  });

  it("estágio fica fora da HE média; VT entra uma vez por matrícula no mês", () => {
    const f = lerFolha({
      Rubricas: [
        RUB,
        ["03/2025", 1, "PEDREIRO", 200, "", 10, 150],
        ["03/2025", 2, "ESTAGIÁRIO", 200, "", 50, 300],
        ["03/2025", 3, "PEDREIRO", 1, "", 110, 825],
        ["03/2025", 3, "SERVENTE", 1, "", 110, 550],
      ],
      Pessoas: [
        PES,
        ["03/2025", 1, "PEDREIRO", "", "", "", 0, 0, 0, ""],
        ["03/2025", 2, "ESTAGIÁRIO", "", "", "", 0, 0, 0, ""],
        ["03/2025", 3, "PEDREIRO", 15, "", "", 0, 0, 0, ""],
        ["03/2025", 3, "SERVENTE", 16, "", "", 0, 0, 0, ""],
      ],
    });
    const vt = [{ comp: mar, matricula: "3", valor: 200 }];
    const m = montarCarga(DADOS, { folha: f, vt }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    expect(m.heHorasPorTipo.util).toBe(10);
    expect(m.payload.lancamentos.filter((l) => l.matricula === "3").map((l) => l.vt_valor)).toEqual(
      expect.arrayContaining([200, null]),
    );
  });

  it("NF repetida fica uma; mês escolhido fora do período vira sem competência", () => {
    const nota = {
      arquivo: "a.xml",
      numero: "9",
      prestadorCnpj: "12345678000199",
      comp: null,
      valor: 10,
      iss: 0,
      pis: 0,
      cofins: 0,
      inss: 0,
      ir: 0,
      csll: 0,
    };
    const e = { ...ESCOLHAS_VAZIAS, nfMes: { "12345678000199|9": 7 } };
    const m = montarCarga(
      DADOS,
      { folha: FOLHA, notas: [nota, { ...nota, arquivo: "b.xml" }] },
      CADASTRO,
      e,
      TABELA,
    );
    expect(m.payload.notas).toHaveLength(1);
    expect(m.notasDuplicadas).toBe(1);
    expect(m.payload.notas[0]!.mes_idx).toBeNull();
  });

  it("estorno maior que o lançamento deixa HE negativa: sinalizado", () => {
    const f = lerFolha({
      Rubricas: [RUB, ["03/2025", 1, "PEDREIRO", 200, "", -4, -60]],
      Pessoas: [PES, ["03/2025", 1, "PEDREIRO", "", "", "", 0, 0, 0, ""]],
    });
    const m = montarCarga(DADOS, { folha: f }, CADASTRO, ESCOLHAS_VAZIAS, TABELA);
    expect(m.negativos).toEqual([{ mesIdx: 0, matricula: "1", campo: "HE" }]);
  });
});
