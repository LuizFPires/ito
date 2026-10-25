// M10 — Gestão de usuários (só admin): convidar, desativar e reativar. Usa a chave de serviço,
// que fica só aqui no servidor (nunca no front). Perfil e admin de quem já existe mudam pela API
// comum (RLS de usuarios); a situação (ativo) só muda por aqui, porque mexe no login do Auth.
//
// M14: a lógica fica aqui, sem Deno (index.ts liga ao Deno.serve), para os testes simularem as
// falhas do Auth. Cada chamada tem tempo-limite; falha de rede, 429 ou 5xx nunca vira sucesso e
// fica no registro da função (sem e-mail nem nome).

export interface Dependencias {
  urlBase: string;
  servico: string;
  publica: string;
  /** ITO_SITE_URL: retorno dos links de convite e de senha */
  site: string | undefined;
  local: boolean;
  cors: (req: Request) => Record<string, string>;
  fetch: typeof fetch;
  registrar?: (evento: Record<string, unknown>) => void;
  /** tempo-limite de cada chamada ao Auth e ao banco (ms) */
  limiteMs?: number;
}

const PERFIS = ["planejamento", "engenharia", "dp_rh", "controladoria", "diretoria"];
const BANIDO = "876000h"; // ~100 anos: bloqueia o login sem apagar a conta (a autoria fica)
/** convites por administrador por hora (M14 · S07) */
export const CONVITES_POR_HORA = 20;

export function criarServidor(d: Dependencias) {
  const limiteMs = d.limiteMs ?? 10_000;
  const registrar = d.registrar ?? ((e) => console.error(JSON.stringify(e)));

  return async function tratar(req: Request): Promise<Response> {
    const cors = d.cors(req);
    const resposta = (status: number, corpo: unknown) =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });
    let acao = "?";

    const servico = { apikey: d.servico, Authorization: `Bearer ${d.servico}` };

    /** Chamada ao Auth ou ao banco: tempo-limite e falha de rede viram { ok: false } (status 0). */
    async function chamar(
      caminho: string,
      init: RequestInit & { json?: unknown; como?: Record<string, string> } = {},
    ) {
      const etapa = `${init.method ?? "GET"} ${caminho.split("?")[0]!.replace(/[0-9a-f-]{36}/gi, ":id")}`;
      try {
        const r = await d.fetch(`${d.urlBase}${caminho}`, {
          ...init,
          headers: {
            ...(init.como ?? servico),
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
          body: init.json === undefined ? init.body : JSON.stringify(init.json),
          signal: AbortSignal.timeout(limiteMs),
        });
        const texto = await r.text();
        let corpo: Record<string, unknown>;
        try {
          corpo = texto ? JSON.parse(texto) : {};
        } catch {
          corpo = { message: texto };
        }
        if (!r.ok && r.status !== 422 && r.status !== 404)
          registrar({ funcao: "usuarios", acao, etapa, status: r.status });
        return { ok: r.ok, status: r.status, corpo };
      } catch (e) {
        const tempo = (e as Error)?.name === "TimeoutError";
        registrar({ funcao: "usuarios", acao, etapa, status: tempo ? "tempo" : "rede" });
        return { ok: false, status: 0, corpo: { message: "" } as Record<string, unknown> };
      }
    }

    const mensagemBanco = (c: Record<string, unknown>) =>
      String(c.message || c.msg || "Não foi possível gravar. Tente de novo.");

    /** Grava na linha de usuarios com o admin que chamou como autor (auditoria e proteções). */
    const gerir = (autor: string, id: string, patch: Record<string, unknown>) =>
      chamar("/rest/v1/rpc/gerir_usuario", {
        method: "POST",
        json: { p_autor: autor, p_id: id, p_patch: patch },
      });

    const destinoDoLink = (origem: string) =>
      origem ? `?redirect_to=${encodeURIComponent(`${origem}/definir-senha`)}` : "";

    /** Quem chama: precisa estar logado, ativo e ser admin (sou_admin já exige ativo e AAL2). */
    async function chamador(): Promise<{ id: string } | Response> {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return erro(401, "Entre no ITO de novo.");
      const como = { apikey: d.publica, Authorization: auth };
      const u = await chamar("/auth/v1/user", { como });
      if (u.status === 0) return erro(503, "O login não respondeu. Tente de novo em instantes.");
      if (!u.ok || !u.corpo.id) return erro(401, "Sessão expirada. Entre no ITO de novo.");
      const a = await chamar("/rest/v1/rpc/sou_admin", { method: "POST", json: {}, como });
      if (a.status === 0) return erro(503, "O banco não respondeu. Tente de novo em instantes.");
      if (!a.ok || (a.corpo as unknown) !== true)
        return erro(403, "Só um administrador gere usuários.");
      return { id: String(u.corpo.id) };
    }

    async function enviarLink(email: string, origem: string, nome?: string) {
      const convite = await chamar(`/auth/v1/invite${destinoDoLink(origem)}`, {
        method: "POST",
        json: nome ? { email, data: { nome } } : { email },
      });
      if (convite.ok) return { ok: true as const, id: String(convite.corpo.id), novo: true };
      const jaExiste =
        convite.status === 422 || /already|registered/i.test(String(convite.corpo.message ?? ""));
      if (!jaExiste) return { ok: false as const };
      const troca = await chamar(`/auth/v1/recover${destinoDoLink(origem)}`, {
        method: "POST",
        json: { email },
      });
      return troca.ok ? { ok: true as const, id: "", novo: false } : { ok: false as const };
    }

    async function convidar(corpo: Record<string, unknown>, origem: string, quem: string) {
      const email = String(corpo.email ?? "")
        .trim()
        .toLowerCase();
      const nome = String(corpo.nome ?? "").trim();
      const perfil = String(corpo.perfil ?? "");
      const admin = corpo.admin === true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(400, "Informe um e-mail válido.");
      if (!nome) return erro(400, "Informe o nome de quem vai entrar.");
      if (!PERFIS.includes(perfil)) return erro(400, "Escolha o perfil.");

      // M14 · S07: até 20 convites por hora por administrador (conta no banco, também com erro)
      const cota = await chamar("/rest/v1/rpc/usar_cota", {
        method: "POST",
        json: {
          p_usuario: quem,
          p_acao: "convite",
          p_maximo: CONVITES_POR_HORA,
          p_janela: "1 hour",
        },
      });
      if (!cota.ok)
        return erro(502, "Não foi possível conferir o limite de convites. Tente de novo.");
      if ((cota.corpo as unknown) !== true)
        return erro(
          429,
          `Limite de ${CONVITES_POR_HORA} convites por hora. Tente de novo mais tarde.`,
        );

      const existe = await chamar(
        `/rest/v1/usuarios?select=id&email=eq.${encodeURIComponent(email)}`,
      );
      if (!existe.ok) return erro(502, "O banco não respondeu. Tente de novo em instantes.");
      if (Array.isArray(existe.corpo) && existe.corpo.length)
        return erro(
          409,
          "Já existe um usuário com esse e-mail. Use “Enviar link de senha” na lista (ou Reativar, se estiver desativado).",
        );
      const link = await enviarLink(email, origem, nome);
      if (!link.ok || !link.novo)
        return erro(502, "O convite não foi enviado. Tente de novo em instantes.");
      // perfil e admin: no Auth (app_metadata, só o servidor define) e na linha de usuarios
      const meta = await chamar(`/auth/v1/admin/users/${link.id}`, {
        method: "PUT",
        json: { app_metadata: { perfil, admin } },
      });
      if (!meta.ok)
        return erro(
          502,
          "O convite saiu, mas o perfil não foi gravado no login. Ajuste o perfil na lista.",
        );
      const linha = await gerir(quem, link.id, { nome, perfil, admin });
      if (!linha.ok) return erro(500, mensagemBanco(linha.corpo));
      return resposta(200, { id: link.id });
    }

    const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

    /**
     * M13 · S03: o link vai para o e-mail da conta no Auth (resolvida pelo UUID), não para o
     * e-mail guardado no cadastro. Convite de novo só para quem nunca confirmou; os demais
     * recebem a recuperação de senha, que nunca cria conta.
     */
    async function linkDeSenha(id: string, origem: string) {
      if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
      const u = await chamar(`/rest/v1/usuarios?select=ativo&id=eq.${id}`);
      if (!u.ok) return erro(502, "O banco não respondeu. Tente de novo em instantes.");
      const linha = Array.isArray(u.corpo) ? (u.corpo[0] as { ativo: boolean }) : null;
      if (!linha) return erro(404, "Usuário não encontrado. Atualize a página.");
      if (!linha.ativo) return erro(400, "Reative o usuário antes de enviar o link.");
      const conta = await chamar(`/auth/v1/admin/users/${id}`);
      if (conta.status === 0 || conta.status >= 500)
        return erro(502, "O login não respondeu. Tente de novo em instantes.");
      const email = String(conta.corpo.email ?? "");
      if (!conta.ok || !email)
        return erro(404, "Conta de acesso não encontrada. Atualize a página.");
      const caminho = conta.corpo.email_confirmed_at ? "/auth/v1/recover" : "/auth/v1/invite";
      const envio = await chamar(`${caminho}${destinoDoLink(origem)}`, {
        method: "POST",
        json: { email },
      });
      if (!envio.ok) return erro(502, "O e-mail não foi enviado. Tente de novo em instantes.");
      return resposta(200, { id });
    }

    async function mudarSituacao(id: string, ativo: boolean, quem: string) {
      if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
      if (!ativo && id === quem)
        return erro(400, "Você não pode desativar a si mesmo. Peça a outro administrador.");
      // primeiro o banco: o gatilho recusa deixar o ITO sem admin ativo
      const linha = await gerir(quem, id, { ativo });
      if (!linha.ok) return erro(linha.status === 0 ? 502 : 400, mensagemBanco(linha.corpo));
      if (linha.corpo !== (1 as unknown))
        return erro(404, "Usuário não encontrado. Atualize a página.");
      const auth = await chamar(`/auth/v1/admin/users/${id}`, {
        method: "PUT",
        json: { ban_duration: ativo ? "none" : BANIDO },
      });
      if (!auth.ok) {
        // reativar: desfaz no banco para as duas pontas não divergirem. Desativar: fica desativado
        // no banco (a RLS já nega tudo) e a pessoa tenta de novo; nunca volta a ativo calado
        if (ativo) await gerir(quem, id, { ativo: false });
        return erro(502, "Não foi possível mudar o acesso no login. Tente de novo.");
      }
      // quem foi desativado sai na hora: sem sessão nem renovação do token (a RLS já nega leituras)
      if (!ativo) {
        const sessoes = await chamar("/rest/v1/rpc/encerrar_sessoes", {
          method: "POST",
          json: { p_id: id },
        });
        if (!sessoes.ok)
          return erro(502, "O acesso foi desativado, mas a sessão aberta não saiu. Tente de novo.");
      }
      return resposta(200, { id, ativo });
    }

    /**
     * M13: zera o segundo fator de quem perdeu o celular. Apaga os fatores no Auth e encerra as
     * sessões (a sessão AAL2 antiga não vale mais); no próximo login a pessoa se inscreve de novo.
     * Fica na auditoria (mfa_zerado_em, com o admin como autor).
     */
    async function zerarMfa(id: string, quem: string) {
      if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
      if (id === quem)
        return erro(400, "Peça a outro administrador para zerar o seu segundo fator.");
      // grava antes (confere que o autor ainda é admin ativo e que a pessoa existe); a auditoria
      // registra o pedido mesmo se o Auth falhar no meio, e repetir é seguro
      const linha = await gerir(quem, id, { mfa_zerado_em: new Date().toISOString() });
      if (!linha.ok) return erro(linha.status === 0 ? 502 : 400, mensagemBanco(linha.corpo));
      if (linha.corpo !== (1 as unknown))
        return erro(404, "Usuário não encontrado. Atualize a página.");
      const fatores = await chamar(`/auth/v1/admin/users/${id}/factors`);
      if (!fatores.ok) return erro(502, "Não foi possível ler o segundo fator. Tente de novo.");
      const lista = Array.isArray(fatores.corpo) ? (fatores.corpo as { id: string }[]) : [];
      for (const f of lista) {
        const apagado = await chamar(`/auth/v1/admin/users/${id}/factors/${f.id}`, {
          method: "DELETE",
        });
        if (!apagado.ok) return erro(502, "Não foi possível zerar o segundo fator. Tente de novo.");
      }
      const sessoes = await chamar("/rest/v1/rpc/encerrar_sessoes", {
        method: "POST",
        json: { p_id: id },
      });
      if (!sessoes.ok)
        return erro(
          502,
          "O segundo fator foi zerado, mas a sessão antiga não saiu. Tente de novo.",
        );
      return resposta(200, { id, fatores: lista.length });
    }

    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return erro(405, "Use POST.");
    const quem = await chamador();
    if (quem instanceof Response) return quem;
    // M13 · S06: corpo pequeno e objeto JSON; endereço de retorno fixo por ambiente
    let corpo: Record<string, unknown>;
    try {
      const texto = await req.text();
      if (texto.length > 10_000) return erro(413, "Pedido grande demais.");
      const lido: unknown = JSON.parse(texto);
      if (!lido || typeof lido !== "object" || Array.isArray(lido))
        return erro(400, "Pedido inválido.");
      corpo = lido as Record<string, unknown>;
    } catch {
      return erro(400, "Pedido inválido.");
    }
    acao = String(corpo.acao ?? "?").slice(0, 20);
    // fora do Supabase local, o retorno dos links vem só do ITO_SITE_URL (nunca do Origin)
    if (!d.site && !d.local)
      return erro(500, "Falta ITO_SITE_URL na função de usuários. Avise o suporte.");
    const origem = d.site ?? req.headers.get("Origin") ?? "";
    switch (corpo.acao) {
      case "convidar":
        return convidar(corpo, origem, quem.id);
      case "link_senha":
        return linkDeSenha(String(corpo.id ?? ""), origem);
      case "desativar":
        return mudarSituacao(String(corpo.id ?? ""), false, quem.id);
      case "reativar":
        return mudarSituacao(String(corpo.id ?? ""), true, quem.id);
      case "zerar_mfa":
        return zerarMfa(String(corpo.id ?? ""), quem.id);
      default:
        return erro(400, "Ação desconhecida.");
    }
  };
}
