import { describe, expect, it } from "vitest";
import { compararCom, definirSelecao, juntarASelecao, limparSelecao } from "./selecao";

const salvo = () => JSON.parse(sessionStorage.getItem("ito.selecao.obras") ?? "[]");

describe("seleção de obras", () => {
  it("guarda na sessão, sem repetir", () => {
    definirSelecao(["a", "b", "a"]);
    expect(salvo()).toEqual(["a", "b"]);
    juntarASelecao(["b", "c"]);
    expect(salvo()).toEqual(["a", "b", "c"]);
  });

  it("“Comparar com…” põe a obra na frente", () => {
    definirSelecao(["a", "b", "c", "d", "e"]);
    compararCom("x");
    expect(salvo()).toEqual(["x", "a", "b", "c", "d", "e"]);
    compararCom("c");
    expect(salvo()).toEqual(["c", "x", "a", "b", "d", "e"]);
  });

  it("limpa ao sair", () => {
    definirSelecao(["a"]);
    limparSelecao();
    expect(salvo()).toEqual([]);
  });
});
