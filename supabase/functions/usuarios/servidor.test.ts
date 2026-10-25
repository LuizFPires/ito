import { describe, expect, it } from "vitest";
import { criarServidor } from "./servidor";

// M14 · S06: falhas do Auth e do banco não viram sucesso; o registro não leva e-mail nem nome
const ADMIN = "00000000-0000-4000-8000-000000000001";
const ALVO = "00000000-0000-4000-8000-000000000003";

type Rota = (url: string, init: RequestInit) => Response | Promise<Response> | "rede" | "lento";
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

/** Respostas padrão de um admin logado; `rotas` sobrepõe por trecho da URL. */
function montar(rotas: Record<string, Rota> = {}) {
  const eventos: Record<string, unknown>[] = [];
  const chamadas: string[] = [];
  const padrao: Record<string, Rota> = {
    "/auth/v1/user": () => json({ id: ADMIN }),
    "/rpc/sou_admin": () => json(true),
    "/rpc/usar_cota": () => json(true),
    "/rest/v1/usuarios?select=id&email": () => json([]),
    "/rest/v1/usuarios?select=ativo": () => json([{ ativo: true }]),
    "/auth/v1/invite": () => json({ id: ALVO }),
    "/auth/v1/recover": () => json({}),
    [`/auth/v1/admin/users/${ALVO}/factors`]: () => json([]),
    [`/auth/v1/admin/users/${ALVO}`]: (_u, i) =>
      i.method === "PUT" ? json({}) : json({ email: "a@ito.local", email_confirmed_at: "x" }),
    "/rpc/gerir_usuario": () => json(1),
    "/rpc/encerrar_sessoes": () => json(1),
  };
  const todas = { ...padrao, ...rotas };
  const tratar = criarServidor({
    urlBase: "http://kong:8000",
    servico: "servico",
    publica: "publica",
    site: "https://ito.exemplo",
    local: true,
    cors: () => ({}),
    limiteMs: 50,
    registrar: (e) => eventos.push(e),
    fetch: (async (url: string, init: RequestInit) => {
      chamadas.push(`${init.method ?? "GET"} ${url}`);
      const chave = Object.keys(todas)
        .filter((k) => url.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = chave ? todas[chave]!(url, init) : json({ message: "?" }, 404);
      if (r === "rede") throw new TypeError("fetch failed");
      if (r === "lento")
        return new Promise((_, falha) =>
          init.signal?.addEventListener("abort", () =>
            falha(Object.assign(new Error("tempo"), { name: "TimeoutError" })),
          ),
        );
      return r;
    }) as typeof fetch,
  });
  const pedir = (corpo: unknown) =>
    tratar(
      new Request("http://f/usuarios", {
        method: "POST",
        headers: { Authorization: "Bearer token-do-admin" },
        body: JSON.stringify(corpo),
      }),
    );
  return { pedir, eventos, chamadas };
}
const corpoDe = async (r: Response) => ((await r.json()) as { erro?: string }).erro ?? "";

describe("função de usuários: falhas do Auth (M14 · S06)", () => {
  it("convite com tudo certo grava o perfil", async () => {
    const t = montar();
    const r = await t.pedir({
      acao: "convidar",
      email: "a@ito.local",
      nome: "A",
      perfil: "engenharia",
    });
    expect(r.status).toBe(200);
    expect(t.eventos).toEqual([]);
  });

  it("Auth lento, sem rede, 429 ou 5xx no convite: erro e registro, nunca sucesso", async () => {
    for (const falha of ["lento", "rede", 429, 503] as const) {
      const t = montar({
        "/auth/v1/invite": () =>
          typeof falha === "number" ? json({ message: "x" }, falha) : falha,
      });
      const r = await t.pedir({
        acao: "convidar",
        email: "a@ito.local",
        nome: "A",
        perfil: "engenharia",
      });
      expect(r.status, String(falha)).toBe(502);
      expect(t.eventos[0]).toMatchObject({ funcao: "usuarios", acao: "convidar" });
      // o registro não leva e-mail, nome nem token
      expect(JSON.stringify(t.eventos)).not.toMatch(/a@ito\.local|token-do-admin/);
      expect(t.chamadas.some((c) => c.includes("gerir_usuario"))).toBe(false);
    }
  });

  it("login fora do ar ao identificar quem chama: 503 com o que fazer", async () => {
    const t = montar({ "/auth/v1/user": () => "lento" });
    const r = await t.pedir({ acao: "desativar", id: ALVO });
    expect(r.status).toBe(503);
    expect(await corpoDe(r)).toContain("Tente de novo");
  });

  it("desativar com falha no Auth fica desativado no banco (acesso negado)", async () => {
    const t = montar({
      [`/auth/v1/admin/users/${ALVO}`]: (_u, i) => (i.method === "PUT" ? json({}, 500) : json({})),
    });
    const r = await t.pedir({ acao: "desativar", id: ALVO });
    expect(r.status).toBe(502);
    const gravacoes = t.chamadas.filter((c) => c.includes("gerir_usuario"));
    expect(gravacoes).toHaveLength(1); // não desfaz para ativo
  });

  it("sessões que não saem ao desativar não viram sucesso", async () => {
    const t = montar({ "/rpc/encerrar_sessoes": () => json({ message: "x" }, 503) });
    const r = await t.pedir({ acao: "desativar", id: ALVO });
    expect(r.status).toBe(502);
  });

  it("link de senha com o Auth fora do ar não diz que a conta não existe", async () => {
    const t = montar({ [`/auth/v1/admin/users/${ALVO}`]: () => json({ message: "x" }, 500) });
    const r = await t.pedir({ acao: "link_senha", id: ALVO });
    expect(r.status).toBe(502);
  });

  it("acima de 20 convites por hora: 429", async () => {
    const t = montar({ "/rpc/usar_cota": () => json(false) });
    const r = await t.pedir({
      acao: "convidar",
      email: "a@ito.local",
      nome: "A",
      perfil: "engenharia",
    });
    expect(r.status).toBe(429);
    expect(t.chamadas.some((c) => c.includes("/auth/v1/invite"))).toBe(false);
  });
});
