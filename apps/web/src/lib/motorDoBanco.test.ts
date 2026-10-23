import { ENCARGOS_REFERENCIA, taxasEncargos } from "@ito/motor";
import { describe, expect, it } from "vitest";
import { funcaoDoBanco, tabelaDoBanco } from "./motorDoBanco";
import type { Database } from "./tipos-banco";

type T = Database["public"]["Tables"];

const dataBase = {
  ano: 2025,
  a_revisar: false,
  he_adicional_util: 100,
  he_adicional_sabado: 100,
  he_adicional_intervalo: 50,
  he_adicional_feriado: 100,
  divisor: 220,
  modo_dias: "calendario",
  sabado_trabalhado: false,
  dias_fixos: 22,
  dsr_fixo_pct: 20,
  vt_diaria_ref: "11.60", // numeric do PostgREST pode vir como texto
  fator_rescisao: 0.9,
  salario_minimo: 1518,
  adicional_noturno_pct: 20,
  sf_teto: 1906.04,
  sf_cota: 65,
} as unknown as T["datas_base"]["Row"];

// encargos da referência na ordem invertida: a tabela reordena por `ordem`
const encargos = ENCARGOS_REFERENCIA.map((e, ordem) => ({
  ano: 2025,
  id: e.id,
  grupo: e.grupo,
  nome: e.nome,
  base_calc_pct: e.baseCalcPct,
  aliq_clt: e.aliqClt,
  aliq_sp: e.aliqSp,
  ordem,
  atualizado_em: "",
  atualizado_por: null,
})).reverse();

describe("tabelaDoBanco", () => {
  const t = tabelaDoBanco(dataBase, { ped: 1650 }, { refeicao: 200 }, encargos);

  it("encargos do banco dão os 43,96% / 22,64% do golden (SPEC §8)", () => {
    const tx = taxasEncargos(t.encargos);
    expect(tx.soc.clt * 100).toBeCloseTo(43.96, 2);
    expect(tx.prov.clt * 100).toBeCloseTo(22.64, 2);
    expect(t.encargos.map((e) => e.id)).toEqual(ENCARGOS_REFERENCIA.map((e) => e.id));
  });

  it("números do PostgREST viram number; HE e salário-família agrupados", () => {
    expect(t.vtDiaria).toBe(11.6);
    expect(t.heAdicionalPct).toEqual({ util: 100, sabado: 100, intervalo: 50, feriado: 100 });
    expect(t.salarioFamilia).toEqual({ teto: 1906.04, cota: 65 });
    expect(t.gratificacoes).toEqual({});
  });
});

describe("funcaoDoBanco", () => {
  it("exames, adicionais e fator de HE", () => {
    const f = funcaoDoBanco({
      id: "ped",
      nome: "Pedreiro",
      conta_pc: "04.03.01",
      escala_area: true,
      vinculo: "clt",
      cor: "a1",
      exame_adm: 150,
      exame_per_anual: 105,
      exame_dem: 150,
      peric_pct: 0,
      insal_pct_sm: 0,
      horas_noturnas_mes: 0,
      ferramentas_mes: 25,
      fator_he: "1.1",
      ativo: true,
      atualizado_em: "",
      atualizado_por: null,
    } as unknown as T["funcoes"]["Row"]);
    expect(f).toMatchObject({
      id: "ped",
      escalaArea: true,
      exames: { adm: 150, perAnual: 105, dem: 150 },
      ferramentasMes: 25,
      fatorHe: 1.1,
    });
  });
});
