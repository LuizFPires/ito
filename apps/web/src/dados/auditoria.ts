/**
 * Auditoria (M10): leitura paginada no servidor (a tabela cresce sem limite). Só admin,
 * controladoria e diretoria leem (RLS); ninguém grava pela API.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Json } from "../lib/auditoria";
import { supabase } from "../lib/supabase";

export interface Alteracao {
  id: number;
  em: string;
  usuario_email: string | null;
  modulo: string;
  tabela: string;
  ref: string | null;
  registro: Record<string, Json>;
  operacao: "insert" | "update" | "delete";
  antes: Record<string, Json> | null;
  depois: Record<string, Json> | null;
}

export interface FiltroAuditoria {
  modulo?: string;
  ref?: string;
  /** e-mail de quem alterou (parte dele) */
  pessoa?: string;
  /** dd/mm/aaaa já convertido para aaaa-mm-dd */
  de?: string | null;
  ate?: string | null;
  pagina: number;
  porPagina: number;
}

export function useAuditoria(f: FiltroAuditoria, ativo = true) {
  return useQuery({
    queryKey: ["auditoria", f] as const,
    enabled: ativo,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("auditoria")
        .select("id, em, usuario_email, modulo, tabela, ref, registro, operacao, antes, depois", {
          count: "exact",
        })
        .order("em", { ascending: false })
        .order("id", { ascending: false });
      if (f.modulo) q = q.eq("modulo", f.modulo);
      if (f.ref) q = q.eq("ref", f.ref);
      if (f.pessoa?.trim()) q = q.ilike("usuario_email", `%${f.pessoa.trim()}%`);
      if (f.de) q = q.gte("em", `${f.de}T00:00:00-03:00`);
      if (f.ate) q = q.lte("em", `${f.ate}T23:59:59.999-03:00`);
      const ini = (f.pagina - 1) * f.porPagina;
      const { data, error, count } = await q.range(ini, ini + f.porPagina - 1);
      if (error) throw error;
      return { linhas: (data ?? []) as unknown as Alteracao[], total: count ?? 0 };
    },
  });
}
