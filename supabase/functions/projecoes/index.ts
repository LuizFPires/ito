// M14 · S05 — Aprovação de projeções calculada no servidor. Quem aprova (controladoria,
// diretoria ou admin, com o segundo fator) chama esta função; ela relê a projeção, as
// referências e os preços com o login dessa pessoa, refaz o cálculo com o mesmo motor da tela
// (calculo.gerado.js) e grava os números por aprovar_projecao, com a chave de serviço.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { cabecalhosCors } from "../_shared/cors.ts";
import { calcularAprovacao, ErroAprovacao, VERSAO_CALCULO } from "./calculo.gerado.js";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLICA = Deno.env.get("SUPABASE_ANON_KEY")!;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req);
  const resposta = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return erro(405, "Use POST.");
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return erro(401, "Entre no ITO de novo.");

  let corpo: Record<string, unknown>;
  try {
    const texto = await req.text();
    if (texto.length > 2_000) return erro(413, "Pedido grande demais.");
    const lido: unknown = JSON.parse(texto);
    if (!lido || typeof lido !== "object" || Array.isArray(lido)) throw new Error();
    corpo = lido as Record<string, unknown>;
  } catch {
    return erro(400, "Pedido inválido.");
  }
  if (corpo.acao !== "aprovar") return erro(400, "Ação desconhecida.");
  const id = String(corpo.id ?? "");
  if (!UUID.test(id)) return erro(400, "Projeção inválida. Atualize a página.");

  // lê com o login de quem aprova (RLS e segundo fator valem aqui também)
  const usuario = createClient(URL_BASE, PUBLICA, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const quem = await usuario.auth.getUser();
  if (quem.error || !quem.data.user) return erro(401, "Sessão expirada. Entre no ITO de novo.");
  const pode = await usuario.rpc("pode_aprovar");
  if (pode.error || pode.data !== true)
    return erro(403, "Só a controladoria, a diretoria ou um administrador aprova projeções.");

  let calculo;
  try {
    calculo = await calcularAprovacao(usuario, id);
  } catch (e) {
    if (e instanceof ErroAprovacao) return erro(422, e.message);
    console.error("projecoes: cálculo falhou", (e as Error)?.message ?? "");
    return erro(502, "Não foi possível calcular a projeção. Tente de novo.");
  }

  const servico = createClient(URL_BASE, SERVICO, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const gravado = await servico.rpc("aprovar_projecao", {
    p_autor: quem.data.user.id,
    p_id: id,
    p_resumo: calculo.resumo,
    p_atualizado_em: calculo.atualizadoEm,
    p_registro: calculo.registro,
  });
  if (gravado.error) {
    const codigo = gravado.error.code ?? "";
    const status = codigo === "42501" ? 403 : codigo === "40001" ? 409 : 400;
    return erro(status, gravado.error.message);
  }
  return resposta(200, {
    id,
    aprovacao: gravado.data,
    resumo: calculo.resumo,
    versao: VERSAO_CALCULO,
  });
});
