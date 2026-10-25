// Gestão de usuários (M10): liga a lógica de servidor.ts ao Deno.serve, com as variáveis do
// Supabase, o ITO_SITE_URL e o CORS do site (M14).
import { cabecalhosCors, LOCAL } from "../_shared/cors.ts";
import { criarServidor } from "./servidor.ts";

Deno.serve(
  criarServidor({
    urlBase: Deno.env.get("SUPABASE_URL")!,
    servico: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    publica: Deno.env.get("SUPABASE_ANON_KEY")!,
    site: Deno.env.get("ITO_SITE_URL")?.replace(/\/+$/, "") || undefined,
    local: LOCAL,
    cors: cabecalhosCors,
    fetch: (...a) => fetch(...a),
  }),
);
