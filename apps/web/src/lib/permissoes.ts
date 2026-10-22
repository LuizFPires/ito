import type { Usuario } from "./supabase";

/**
 * Espelho das funções do banco (pode_editar_config / pode_editar_cadastros), só para a tela.
 * Quem decide é a RLS; aqui só escondemos o que a pessoa não pode fazer.
 */
export function podeEditarConfig(u: Usuario | null | undefined): boolean {
  return !!u && (u.admin || u.perfil === "controladoria");
}

export function podeEditarCadastros(u: Usuario | null | undefined): boolean {
  return !!u && (u.admin || u.perfil === "controladoria" || u.perfil === "dp_rh");
}
