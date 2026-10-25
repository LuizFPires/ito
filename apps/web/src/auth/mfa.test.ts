import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type { Usuario } from "../lib/supabase";
import { nivelDaSessao, precisaDeMfa } from "./mfa";

const token = (aal: string) =>
  ({ access_token: `x.${btoa(JSON.stringify({ aal })).replace(/=+$/, "")}.y` }) as Session;
const u = (p: Partial<Usuario>) =>
  ({ admin: false, perfil: "planejamento", mfa_dispensado: false, ...p }) as Usuario;

describe("segundo fator (M13)", () => {
  it("lê o nível da sessão do token", () => {
    expect(nivelDaSessao(token("aal1"))).toBe("aal1");
    expect(nivelDaSessao(token("aal2"))).toBe("aal2");
    expect(nivelDaSessao(null)).toBeNull();
  });
  it("admin, controladoria e diretoria precisam; os demais e os dispensados, não", () => {
    expect(precisaDeMfa(u({ admin: true }))).toBe(true);
    expect(precisaDeMfa(u({ perfil: "controladoria" }))).toBe(true);
    expect(precisaDeMfa(u({ perfil: "diretoria" }))).toBe(true);
    expect(precisaDeMfa(u({ perfil: "dp_rh" }))).toBe(false);
    expect(precisaDeMfa(u({ perfil: "diretoria", mfa_dispensado: true }))).toBe(false);
    expect(precisaDeMfa(null)).toBe(false);
  });
});
