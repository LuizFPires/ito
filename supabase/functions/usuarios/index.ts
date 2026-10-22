// M10 — Gestão de usuários (só admin): convidar, desativar e reativar. Usa a chave de serviço,
// que fica só aqui no servidor (nunca no front). Perfil e admin de quem já existe mudam pela API
// comum (RLS de usuarios); a situação (ativo) só muda por aqui, porque mexe no login do Auth.

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLICA = Deno.env.get("SUPABASE_ANON_KEY")!;
const PERFIS = ["planejamento", "engenharia", "dp_rh", "controladoria", "diretoria"];
const BANIDO = "876000h"; // ~100 anos: bloqueia o login sem apagar a conta (a autoria fica)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

const servico = { apikey: SERVICO, Authorization: `Bearer ${SERVICO}` };

async function chamar(caminho: string, init: RequestInit & { json?: unknown } = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    ...init,
    headers: { ...servico, "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: init.json === undefined ? init.body : JSON.stringify(init.json),
  });
  const texto = await r.text();
  let corpo: Record<string, unknown>;
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    corpo = { message: texto };
  }
  return { ok: r.ok, status: r.status, corpo };
}

/** Quem chama: precisa estar logado, ativo e ser admin (sou_admin já exige ativo). */
async function chamador(req: Request): Promise<{ id: string } | Response> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return erro(401, "Entre no ITO de novo.");
  const u = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: PUBLICA, Authorization: auth },
  });
  if (!u.ok) return erro(401, "Sessão expirada. Entre no ITO de novo.");
  const { id } = (await u.json()) as { id: string };
  const a = await fetch(`${URL_BASE}/rest/v1/rpc/sou_admin`, {
    method: "POST",
    headers: { apikey: PUBLICA, Authorization: auth, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!a.ok || (await a.json()) !== true) return erro(403, "Só um administrador gere usuários.");
  return { id };
}

const mensagemBanco = (c: Record<string, unknown>) =>
  String(c.message ?? c.msg ?? "Não foi possível gravar. Tente de novo.");

async function convidar(corpo: Record<string, unknown>, origem: string) {
  const email = String(corpo.email ?? "")
    .trim()
    .toLowerCase();
  const nome = String(corpo.nome ?? "").trim();
  const perfil = String(corpo.perfil ?? "");
  const admin = corpo.admin === true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(400, "Informe um e-mail válido.");
  if (!nome) return erro(400, "Informe o nome de quem vai entrar.");
  if (!PERFIS.includes(perfil)) return erro(400, "Escolha o perfil.");

  // o Auth lê o destino do link na query (e confere com a lista de endereços permitidos)
  const destino = origem ? `?redirect_to=${encodeURIComponent(`${origem}/definir-senha`)}` : "";
  const convite = await chamar(`/auth/v1/invite${destino}`, {
    method: "POST",
    json: { email, data: { nome } },
  });
  if (!convite.ok) {
    const jaExiste =
      convite.status === 422 || /already|registered/i.test(mensagemBanco(convite.corpo));
    return erro(
      jaExiste ? 409 : 502,
      jaExiste
        ? "Já existe um usuário com esse e-mail. Reative-o na lista, se estiver desativado."
        : "O convite não foi enviado. Tente de novo em instantes.",
    );
  }
  const id = String(convite.corpo.id);
  // perfil e admin: no Auth (app_metadata, só o servidor define) e na linha de usuarios
  await chamar(`/auth/v1/admin/users/${id}`, {
    method: "PUT",
    json: { app_metadata: { perfil, admin } },
  });
  const linha = await chamar(`/rest/v1/usuarios?id=eq.${id}`, {
    method: "PATCH",
    json: { nome, perfil, admin },
  });
  if (!linha.ok) return erro(500, mensagemBanco(linha.corpo));
  return resposta(200, { id });
}

async function mudarSituacao(id: string, ativo: boolean, quem: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return erro(400, "Usuário inválido. Atualize a página.");
  if (!ativo && id === quem)
    return erro(400, "Você não pode desativar a si mesmo. Peça a outro administrador.");
  // primeiro o banco: o gatilho recusa deixar o ITO sem admin ativo
  const linha = await chamar(`/rest/v1/usuarios?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    json: { ativo },
  });
  if (!linha.ok) return erro(400, mensagemBanco(linha.corpo));
  if (!Array.isArray(linha.corpo) || !linha.corpo.length)
    return erro(404, "Usuário não encontrado. Atualize a página.");
  const auth = await chamar(`/auth/v1/admin/users/${id}`, {
    method: "PUT",
    json: { ban_duration: ativo ? "none" : BANIDO },
  });
  if (!auth.ok) {
    // desfaz no banco para as duas pontas não divergirem
    await chamar(`/rest/v1/usuarios?id=eq.${id}`, { method: "PATCH", json: { ativo: !ativo } });
    return erro(502, "Não foi possível mudar o acesso no login. Tente de novo.");
  }
  return resposta(200, { id, ativo });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro(405, "Use POST.");
  const quem = await chamador(req);
  if (quem instanceof Response) return quem;
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, "Pedido inválido.");
  }
  const origem = req.headers.get("Origin") ?? Deno.env.get("ITO_SITE_URL") ?? "";
  switch (corpo.acao) {
    case "convidar":
      return convidar(corpo, origem);
    case "desativar":
      return mudarSituacao(String(corpo.id ?? ""), false, quem.id);
    case "reativar":
      return mudarSituacao(String(corpo.id ?? ""), true, quem.id);
    default:
      return erro(400, "Ação desconhecida.");
  }
});
