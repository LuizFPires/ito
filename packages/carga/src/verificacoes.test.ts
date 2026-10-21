import { describe, expect, it } from "vitest";
import { CADASTRO, CTX, DADOS, FOLHA, TABELA } from "./fixtures";
import type { LeituraFolha, NotaFiscal } from "./leitores";
import type { Escolhas, Leituras } from "./montagem";
import { ESCOLHAS_VAZIAS, montarCarga } from "./montagem";
import { verificarCarga } from "./verificacoes";

const CLASSIFICADA: Escolhas = {
  ...ESCOLHAS_VAZIAS,
  rubricasNovas: {
    7777: {
      nome: "PRÊMIO ASSIDUIDADE",
      tipo: "provento",
      componente: "extras",
      baseProvisoes: true,
      tipoHe: null,
    },
  },
  realocacao: { "OBRA B": { nome: "Obra B", obraId: null } },
};
const mar = { ano: 2025, mes: 3 };
const abr = { ano: 2025, mes: 4 };
// proventos lidos: mar 1.650 + 150 + 75 + 1.100 = 2.975; abr 1.650 + 825 + 1.100 + 50 = 3.625
const comResumo = (mar25: number): LeituraFolha => ({
  ...FOLHA,
  resumo: [
    { comp: mar, proventos: mar25 },
    { comp: abr, proventos: 3625 },
  ],
});

function verificar(leituras: Leituras, escolhas: Escolhas = CLASSIFICADA) {
  const m = montarCarga(DADOS, leituras, CADASTRO, escolhas, TABELA);
  return verificarCarga(m, leituras, escolhas, CADASTRO, CTX, TABELA);
}
const item = (r: ReturnType<typeof verificar>, id: string) => r.itens.find((v) => v.id === id)!;

describe("verificações da carga", () => {
  it("tudo em ordem: só avisos dos arquivos opcionais, nada bloqueia", () => {
    const r = verificar({ folha: comResumo(2975) });
    expect(item(r, "resumo").estado).toBe("ok");
    expect(item(r, "funcoes").estado).toBe("ok");
    expect(item(r, "rubricas").estado).toBe("ok");
    expect(item(r, "realocada").estado).toBe("ok");
    expect(["ponto", "vt", "nf", "erp"].map((id) => item(r, id).estado)).toEqual([
      "aviso",
      "aviso",
      "aviso",
      "aviso",
    ]);
    expect(r.bloqueia).toBe(false);
    expect(r.conferencia).toHaveLength(2);
  });

  it("proventos × resumo: diferença bloqueia e diz o mês e o valor", () => {
    const r = verificar({ folha: comResumo(3075) });
    expect(item(r, "resumo")).toMatchObject({ estado: "erro" });
    expect(item(r, "resumo").detalhe).toContain("mar/25 (-R$ 100,00)");
    expect(r.bloqueia).toBe(true);
  });

  it("rubrica nova sem classificação e função sem correspondência bloqueiam", () => {
    const r = verificar({ folha: FOLHA }, ESCOLHAS_VAZIAS);
    expect(item(r, "rubricas").estado).toBe("erro");
    expect(item(r, "rubricas").detalhe).toContain("7777 · prêmio assiduidade");
    expect(item(r, "realocada").estado).toBe("aviso");
    expect(r.bloqueia).toBe(true);
  });

  it("VT ausente: avisa por mês e matrícula; confirmado vira ok", () => {
    const vt = [
      { comp: mar, matricula: "1001", valor: 242 },
      { comp: mar, matricula: "1002", valor: 242 },
    ];
    const r = verificar({ folha: FOLHA, vt });
    expect(r.semVt).toEqual([{ mesIdx: 1, matriculas: ["1001", "1003"] }]);
    expect(item(r, "vt").estado).toBe("aviso");
    const ok = verificar({ folha: FOLHA, vt }, { ...CLASSIFICADA, semVtConfirmado: true });
    expect(item(ok, "vt").estado).toBe("ok");
    expect(ok.payload.lancamentos.filter((l) => l.sem_vt).map((l) => l.matricula)).toEqual([
      "1001",
      "1003",
    ]);
  });

  it("ponto × folha: diferença acima de 1% avisa", () => {
    const ponto = [
      { comp: mar, matricula: "1001", he: 15, faltas: 11 },
      { comp: abr, matricula: "1001", he: 4, faltas: 0 },
    ];
    const r = verificar({ folha: FOLHA, ponto });
    expect(item(r, "ponto").estado).toBe("aviso");
    expect(item(r, "ponto").detalhe).toContain("abr/25");
    const igual = verificar({ folha: FOLHA, ponto: [ponto[0]!] });
    expect(item(igual, "ponto").estado).toBe("ok");
  });

  it("NF sem competência bloqueia até alguém escolher o mês", () => {
    const nota: NotaFiscal = {
      arquivo: "nf0412.xml",
      numero: "412",
      prestadorCnpj: "12345678000199",
      comp: null,
      valor: 1000,
      iss: 30,
      pis: 0,
      cofins: 0,
      inss: 0,
      ir: 0,
      csll: 0,
    };
    const r = verificar({ folha: FOLHA, notas: [nota] });
    expect(item(r, "nf").estado).toBe("erro");
    expect(r.nfSemMes).toEqual([
      { chave: "12345678000199|412", numero: "412", arquivo: "nf0412.xml" },
    ]);
    const ok = verificar(
      { folha: FOLHA, notas: [nota] },
      { ...CLASSIFICADA, nfMes: { "12345678000199|412": 1 } },
    );
    expect(item(ok, "nf").estado).toBe("ok");
    expect(ok.payload.notas[0]!.mes_idx).toBe(1);
  });

  it("apropriação × ERP: caixa do ITO contra o realizado; diferença pede justificativa", () => {
    const base = verificar({ folha: FOLHA });
    const caixa = base.resultado!.porMes.map((s) => Math.round(s.caixa * 100) / 100);
    const erp = [
      { comp: mar, conta: "04.03.01", valor: caixa[0]! + 1093.2 },
      { comp: abr, conta: "04.03.01", valor: caixa[1]! },
    ];
    const r = verificar({ folha: FOLHA, erp });
    expect(item(r, "erp").estado).toBe("erro");
    expect(item(r, "erp").detalhe).toContain("mar/25 (R$ 1.093,20)");
    const ok = verificar(
      { folha: FOLHA, erp },
      { ...CLASSIFICADA, justificativas: { 0: "Em análise" } },
    );
    expect(item(ok, "erp").estado).toBe("ok");
    expect(ok.payload.competencias[0]).toMatchObject({
      ito_apropriado: caixa[0],
      erp_realizado: Math.round((caixa[0]! + 1093.2) * 100) / 100,
      justificativa: "Em análise",
    });
  });

  it("conferência rubricas × custo usa os valores reais da folha (descontos negativos)", () => {
    const r = verificar({ folha: FOLHA });
    // mar: 1.650 + 150 + 75 + 1.100 = 2.975 em rubricas que entram no custo
    expect(r.conferencia[0]!.rubricas).toBe(2975);
    expect(r.conferencia[0]!.custo).toBeCloseTo(r.resultado!.porMes[0]!.remun, 1);
  });
});
