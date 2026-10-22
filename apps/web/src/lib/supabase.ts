import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos-banco";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !chave) {
  throw new Error(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em apps/web/.env.local (veja .env.example).",
  );
}

/**
 * Chegou pelo link do convite (ou de troca de senha): lido antes de o cliente consumir o
 * endereço, para a pessoa ir definir a senha mesmo que o link caia na página inicial.
 */
export const veioDoConvite =
  typeof window !== "undefined" && /type=(invite|recovery)/.test(window.location.hash);

export const supabase = createClient<Database>(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Usuario = Database["public"]["Tables"]["usuarios"]["Row"];
export type Perfil = Database["public"]["Enums"]["perfil"];

export const NOME_PERFIL: Record<Perfil, string> = {
  planejamento: "Planejamento / orçamento",
  engenharia: "Engenharia de obra",
  dp_rh: "DP / RH",
  controladoria: "Controladoria",
  diretoria: "Diretoria",
};
