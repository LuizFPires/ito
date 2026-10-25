// CORS das Edge Functions do ITO (M14): só o site do ITO (ITO_SITE_URL), os previews da Vercel
// do projeto e, no Supabase local, o Vite. Outros sites não leem as respostas.

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? "";
export const LOCAL = /\/\/(kong|127\.0\.0\.1|localhost)[:/]/.test(URL_BASE);
const SITE = Deno.env.get("ITO_SITE_URL") ?? "";
const PREVIEW = /^https:\/\/ito-[a-z0-9-]+-luiz-fp-ires\.vercel\.app$/;
const DEV = /^http:\/\/(localhost|127\.0\.0\.1):(5173|4173)$/;

export function origemPermitida(origem: string | null): boolean {
  if (!origem) return false;
  return origem === SITE || PREVIEW.test(origem) || (LOCAL && DEV.test(origem));
}

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get("Origin");
  return {
    ...(origemPermitida(origem) ? { "Access-Control-Allow-Origin": origem! } : {}),
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
