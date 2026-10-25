import { describe, expect, it } from "vitest";
import { buscarDestinos, itemAtivo, MENU, menuDe } from "./rotas";

describe("menu", () => {
  it("tem os 8 itens do PRD em 3 grupos e a administração (M10)", () => {
    expect(MENU.map((d) => d.nome)).toEqual([
      "Base histórica",
      "Comparar obras",
      "Projeções",
      "Carga de dados",
      "Cidades e CCTs",
      "Parâmetros",
      "Funções padrão",
      "Rubricas da folha",
      "Auditoria",
      "Usuários",
      "Desempenho",
    ]);
  });

  it("auditoria só para admin, controladoria e diretoria", () => {
    const u = (perfil: string, admin = false) =>
      ({ id: "x", email: "x", nome: "x", perfil, admin, ativo: true }) as Parameters<
        typeof menuDe
      >[0];
    const tem = (x: Parameters<typeof menuDe>[0]) =>
      menuDe(x).some((d) => d.caminho === "/auditoria");
    expect(tem(u("engenharia"))).toBe(false);
    expect(tem(u("engenharia", true))).toBe(true);
    expect(tem(u("diretoria"))).toBe(true);
    expect(tem(u("controladoria"))).toBe(true);
    expect(buscarDestinos("auditoria", u("dp_rh"))).toEqual([]);
    const usuarios = (x: Parameters<typeof menuDe>[0]) =>
      menuDe(x).some((d) => d.caminho === "/usuarios");
    expect(usuarios(u("controladoria"))).toBe(false);
    expect(usuarios(u("engenharia", true))).toBe(true);
    expect(tem({ ...u("diretoria"), ativo: false } as Parameters<typeof menuDe>[0])).toBe(false);
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
