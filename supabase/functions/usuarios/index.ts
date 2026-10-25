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

/** Grava na linha de usuarios com o admin que chamou como autor (auditoria e proteções). */
const gerir = (autor: string, id: string, patch: Record<string, unknown>) =>
  chamar("/rest/v1/rpc/gerir_usuario", {
    method: "POST",
    json: { p_autor: autor, p_id: id, p_patch: patch },
  });

const destinoDoLink = (origem: string) =>
  origem ? `?redirect_to=${encodeURIComponent(`${origem}/definir-senha`)}` : "";

/**
 * Link para definir a senha: convite de novo para quem ainda não entrou; para quem já tem conta
 * confirmada, o e-mail de troca de senha. Os dois levam a /definir-senha.
 */
async function enviarLink(email: string, origem: string, nome?: string) {
  const convite = await chamar(`/auth/v1/invite${destinoDoLink(origem)}`, {
    method: "POST",
    json: nome ? { email, data: { nome } } : { email },
  });
  if (convite.ok) return { ok: true as const, id: String(convite.corpo.id), novo: true };
  const jaExiste =
    convite.status === 422 || /already|registered/i.test(mensagemBanco(convite.corpo));
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

  const existe = await chamar(`/rest/v1/usuarios?select=id&email=eq.${encodeURIComponent(email)}`);
  if (Array.isArray(existe.corpo) && existe.corpo.length)
    return erro(
      409,
      "Já existe um usuário com esse e-mail. Use “Enviar link de senha” na lista (ou Reativar, se estiver desativado).",
    );
  const link = await enviarLink(email, origem, nome);
  if (!link.ok || !link.novo)
    return erro(502, "O convite não foi enviado. Tente de novo em instantes.");
  // perfil e admin: no Auth (app_metadata, só o servidor define) e na linha de usuarios
  await chamar(`/auth/v1/admin/users/${link.id}`, {
    method: "PUT",
    json: { app_metadata: { perfil, admin } },
  });
  const linha = await gerir(quem, link.id, { nome, perfil, admin });
  if (!linha.ok) return erro(500, mensagemBanco(linha.corpo));
  return resposta(200, { id: link.id });
}

const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

async function linkDeSenha(id: string, origem: string) {
  if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
  const u = await chamar(`/rest/v1/usuarios?select=email,ativo&id=eq.${id}`);
  const linha = Array.isArray(u.corpo) ? (u.corpo[0] as { email: string; ativo: boolean }) : null;
  if (!linha) return erro(404, "Usuário não encontrado. Atualize a página.");
  if (!linha.ativo) return erro(400, "Reative o usuário antes de enviar o link.");
  const link = await enviarLink(linha.email, origem);
  if (!link.ok) return erro(502, "O e-mail não foi enviado. Tente de novo em instantes.");
  return resposta(200, { id });
}

async function mudarSituacao(id: string, ativo: boolean, quem: string) {
  if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
  if (!ativo && id === quem)
    return erro(400, "Você não pode desativar a si mesmo. Peça a outro administrador.");
  // primeiro o banco: o gatilho recusa deixar o ITO sem admin ativo
  const linha = await gerir(quem, id, { ativo });
  if (!linha.ok) return erro(400, mensagemBanco(linha.corpo));
  if (linha.corpo !== (1 as unknown))
    return erro(404, "Usuário não encontrado. Atualize a página.");
  const auth = await chamar(`/auth/v1/admin/users/${id}`, {
    method: "PUT",
    json: { ban_duration: ativo ? "none" : BANIDO },
  });
  if (!auth.ok) {
    // desfaz no banco para as duas pontas não divergirem
    await gerir(quem, id, { ativo: !ativo });
    return erro(502, "Não foi possível mudar o acesso no login. Tente de novo.");
  }
  // quem foi desativado sai na hora: sem sessão nem renovação do token (a RLS já nega leituras)
  if (!ativo) await chamar("/rest/v1/rpc/encerrar_sessoes", { method: "POST", json: { p_id: id } });
  return resposta(200, { id, ativo });
}

/**
 * M13: zera o segundo fator de quem perdeu o celular. Apaga os fatores no Auth e encerra as
 * sessões (a sessão AAL2 antiga não vale mais); no próximo login a pessoa se inscreve de novo.
 * Fica na auditoria (mfa_zerado_em, com o admin como autor).
 */
async function zerarMfa(id: string, quem: string) {
  if (!idValido(id)) return erro(400, "Usuário inválido. Atualize a página.");
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
    return erro(502, "O segundo fator foi zerado, mas a sessão antiga não saiu. Tente de novo.");
  const linha = await gerir(quem, id, { mfa_zerado_em: new Date().toISOString() });
  if (!linha.ok) return erro(400, mensagemBanco(linha.corpo));
  return resposta(200, { id, fatores: lista.length });
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
});
