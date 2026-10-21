import { describe, expect, it } from "vitest";
import type { LinhaBase } from "./base";
import { filtrar, indicadores, mediana, ordenarBase } from "./base";

const obra = (id: string, p: Partial<LinhaBase> = {}): LinhaBase => ({
  id,
  nome: `Obra ${id}`,
  cliente: "Cliente",
  tipologia: "Comercial",
  grupo: "outras",
  cidade_id: null,
  cidade: "Belo Horizonte/MG",
  area_m2: 1000,
  inicio: "2025-03-01",
  meses: 2,
  data_base: 2025,
  resumo: {
    obra_id: id,
    vigente: 2026,
    versao: 1,
    pico: 10,
    pessoa_mes: 20,
    he_por_pessoa: 12,
    indireta_pct: 15,
    custo_epoca: 100_000,
    custo_atual: 120_000,
    histograma: [10, 10],
  },
  ...p,
});

describe("base histórica", () => {
  const lista = [
    obra("a", { grupo: "mm", cliente: "Mart Minas" }),
    obra("b", { grupo: "galpao", cidade: "Paracatu/MG", area_m2: 2000 }),
    obra("c", { resumo: null }),
  ];

  it("filtra por grupo e por nome, cliente ou cidade", () => {
    expect(filtrar(lista, "mm", "").map((o) => o.id)).toEqual(["a"]);
    expect(filtrar(lista, "todas", "paracatu").map((o) => o.id)).toEqual(["b"]);
    expect(filtrar(lista, "todas", "mart").map((o) => o.id)).toEqual(["a"]);
  });

  it("ordena por coluna; sem resumo vai para o fim na ordem crescente", () => {
    expect(ordenarBase(lista, { chave: "area", dir: -1 }).map((o) => o.id)[0]).toBe("b");
    expect(ordenarBase(lista, { chave: "pico", dir: 1 }).map((o) => o.id)[0]).toBe("c");
  });

  it("indicadores do filtro como no protótipo", () => {
    const k = indicadores(lista);
    expect(k.obras).toBe(3);
    expect(k.duracaoMedianaDias).toBe(61);
    expect(k.picoMedio).toBe(10);
    // PM/1.000 m²: 20 e 10 → média 15
    expect(k.pmPorMilMedia).toBe(15);
    // custo/m²: 120 e 60
    expect(k.custoM2Medio).toBe(90);
    expect(mediana([3, 1, 2, 10])).toBe(2.5);
  });
});
