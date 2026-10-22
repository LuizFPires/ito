import type { Contexto, Funcao, Tabela } from "@ito/motor";
import { describe, expect, it } from "vitest";
import { CTX, FUNCOES, TABELA } from "../../../../packages/carga/src/fixtures";
import type { ObraBanco } from "./obraDoBanco";
import type { Entradas } from "./projecaoDoBanco";
import { calcularProjecao, cenarios, entradasVazias } from "./projecaoDoBanco";

// Meta do PRD §5: recálculo de uma projeção em menos de 300 ms. Caso pesado e sintético:
// 20 funções, 5 obras de referência de 36 meses e projeção de 36 meses, com os cenários de origem.
const N = 36;
const funcoes: Funcao[] = Array.from({ length: 20 }, (_, i) => ({
  ...FUNCOES[i % 3]!,
  id: `f${i}`,
}));
const ctx: Contexto = { ...CTX, funcoes };
const tabela: Tabela = {
  ...TABELA,
  salarios: Object.fromEntries(funcoes.map((f, i) => [f.id, 1500 + 100 * i])),
};

function obraSintetica(k: number): ObraBanco {
  const id = `ref${k}`;
  return {
    obra: {
      id,
      nome: `Referência ${k}`,
      inicio: "2023-01-01",
      meses: N,
      area_m2: 8000 + 1000 * k,
      data_base: 2025,
      grat_premios_pct: 3,
      transf_pct: 25,
      funcoes_transferidas: [],
      risco_pct: 0,
      lucro_pct: 0,
      trib_lucro_pct: 0,
      provisionar: true,
      adiantamento: true,
      adiantamento_pct: 40,
      fora_da_sede: false,
      rotatividade_pct: 4,
      he_mix_util: 70,
      he_mix_sabado: 20,
      he_mix_intervalo: 5,
      he_mix_feriado: 5,
      revisao: 0,
    } as unknown as ObraBanco["obra"],
    competencias: Array.from({ length: N }, (_, m) => ({
      obra_id: id,
      mes_idx: m,
      he_media: 12,
      absenteismo_pct: 2.5,
      licenca_pessoa_dias: 3,
      ferias_pessoa_dias: 10,
    })) as unknown as ObraBanco["competencias"],
    efetivo: funcoes.flatMap((f, i) =>
      Array.from({ length: N }, (_, m) => {
        const curva = Math.sin((Math.PI * (m + 1)) / (N + 1));
        const equivalente = Math.round((2 + ((i + k) % 7)) * curva * 10) / 10;
        return {
          obra_id: id,
          funcao_id: f.id,
          mes_idx: m,
          equivalente,
          cabecas: Math.ceil(equivalente),
          admissoes: m % 5 === 0 ? 1 : 0,
          desligamentos: m % 6 === 0 ? 1 : 0,
        };
      }),
    ),
    regime: [],
    trocas: [],
    feriados: [],
  };
}

describe("desempenho (PRD §5)", () => {
  const referencias = [0, 1, 2, 3, 4].map(obraSintetica);
  const e: Entradas = {
    ...entradasVazias(new Date(2026, 9, 22)),
    nome: "Carga pesada",
    cidadeId: "vespasiano",
    inicio: { ano: 2027, mes: 3 },
    prazo: N,
    area: 12000,
  };
  const precos = { vigente: tabela, cidade: null, cidadeOrigem: null, cct: null };

  it("projeção de 36 meses com 5 referências e 20 funções recalcula em menos de 300 ms", () => {
    const rodar = () => {
      const c = calcularProjecao(e, referencias, precos, ctx);
      cenarios(c, ctx);
      return c;
    };
    expect(rodar().r).not.toBeNull(); // aquece e confere que calculou de verdade
    const tempos = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      rodar();
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    const mediana = tempos[2]!;
    console.info(`projeção pesada: mediana ${Math.round(mediana)} ms`);
    expect(mediana).toBeLessThan(300);
  });
});
