import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTema } from "./tema";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("useTema", () => {
  it("começa seguindo o sistema (sem data-theme)", () => {
    const { result } = renderHook(() => useTema());
    expect(result.current.tema).toBe("sistema");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("aplica e lembra o escuro", () => {
    const { result } = renderHook(() => useTema());
    act(() => result.current.setTema("escuro"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("ito.tema")).toBe("escuro");
    const outro = renderHook(() => useTema());
    expect(outro.result.current.tema).toBe("escuro");
  });

  it("voltar ao sistema remove a escolha", () => {
    const { result } = renderHook(() => useTema());
    act(() => result.current.setTema("claro"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    act(() => result.current.setTema("sistema"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("ito.tema")).toBeNull();
  });
});
