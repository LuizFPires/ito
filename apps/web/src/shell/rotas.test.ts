import { describe, expect, it } from "vitest";
import { buscarDestinos, itemAtivo, MENU } from "./rotas";

describe("menu", () => {
  it("tem os 8 itens do PRD em 3 grupos", () => {
    expect(MENU.map((d) => d.nome)).toEqual([
      "Base histórica",
      "Comparar obras",
      "Projeções",
      "Carga de dados",
      "Cidades e CCTs",
      "Parâmetros",
      "Funções padrão",
      "Rubricas da folha",
    ]);
  });

  it("não usa a palavra praça", () => {
    for (const d of MENU) expect(`${d.nome} ${d.resumo}`.toLowerCase()).not.toContain("praça");
  });

  it("detalhes marcam o item pai", () => {
    expect(itemAtivo("/obras/paracatu")).toBe("/base");
    expect(itemAtivo("/projecoes/p1")).toBe("/projecoes");
    expect(itemAtivo("/cidades")).toBe("/cidades");
    expect(itemAtivo("/nada")).toBeUndefined();
  });
});

describe("buscarDestinos", () => {
  it("ignora acento e caixa", () => {
    expect(buscarDestinos("PROJECOES").map((d) => d.caminho)).toEqual(["/projecoes"]);
    expect(buscarDestinos("parametros")[0]?.caminho).toBe("/parametros");
  });
  it("todos os termos precisam bater", () => {
    expect(buscarDestinos("cct salários").map((d) => d.caminho)).toEqual(["/cidades"]);
  });
  it("vazio não lista nada", () => {
    expect(buscarDestinos("   ")).toEqual([]);
  });
});
