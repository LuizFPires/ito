import { describe, expect, it } from "vitest";
import type { ItemProjecao } from "../../dados/projecoes";
import {
  descreverBase,
  filtrarProjecoes,
  manualValido,
  ordenarProjecoes,
  rotulosMeses,
  textoTabulado,
} from "./projecoes";

const p = (x: Partial<ItemProjecao>) =>
  ({
    id: "x",
    nome: "P",
    cliente: "",
    tipologia: "",
    cidade_id: null,
    area_m2: 1000,
    situacao: "rascunho",
    resumo: {},
    criado_em: "2026-10-01T00:00:00Z",
    referencias: [],
    estatistica: "media",
    quantidades_manuais: null,
    prazo_meses: 3,
    ...x,
  }) as ItemProjecao;

describe("lista de projeções", () => {
  const lista = [
    p({ id: "a", nome: "Atacarejo Contagem", situacao: "aprovada", resumo: { total: 900 } }),
    p({ id: "b", nome: "Galpão Betim", cliente: "Cliente Sul", resumo: { total: 1200 } }),
    p({ id: "c", nome: "Loja", cidade_id: "vespasiano" }),
  ];
  const cid = (id: string | null) => (id === "vespasiano" ? "Vespasiano/MG" : "");

  it("filtra por situação e por nome, cliente ou cidade (sem acento)", () => {
    expect(filtrarProjecoes(lista, "aprovada", "", cid).map((x) => x.id)).toEqual(["a"]);
    expect(filtrarProjecoes(lista, "todas", "cliente sul", cid).map((x) => x.id)).toEqual(["b"]);
    expect(filtrarProjecoes(lista, "todas", "vespasiano", cid).map((x) => x.id)).toEqual(["c"]);
    expect(filtrarProjecoes(lista, "todas", "galpao", cid).map((x) => x.id)).toEqual(["b"]);
  });

  it("ordena por custo; sem resumo vai para o fim no decrescente", () => {
    expect(ordenarProjecoes(lista, { chave: "total", dir: -1 }).map((x) => x.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("descreve a base", () => {
    expect(descreverBase(p({ referencias: ["o1", "o2"], estatistica: "mediana" }))).toBe(
      "2 obras · mediana",
    );
    expect(descreverBase(p({ quantidades_manuais: { ped: [1, 2, 3] } }))).toBe(
      "quantidades informadas",
    );
    // série com outro tamanho não vale (o motor também ignora)
    expect(manualValido({ ped: [1, 2] }, 3)).toBe(false);
  });
});

describe("copiar para Excel", () => {
  it("texto tabulado com números no formato BR", () => {
    expect(
      textoTabulado([
        ["Função", "jan/27"],
        ["Pedreiro\tA", 1234.5],
      ]),
    ).toBe("Função\tjan/27\r\nPedreiro A\t1.234,50");
  });

  it("rótulos dos meses do prazo", () => {
    expect(rotulosMeses({ ano: 2026, mes: 11 }, 3)).toEqual(["nov/26", "dez/26", "jan/27"]);
    expect(rotulosMeses({ ano: 2026, mes: 11 }, 2, true)).toEqual(["mês 1", "mês 2"]);
  });
});
