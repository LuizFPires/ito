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

/** Espelho de pode_carregar (decisão M4): DP/RH, controladoria e admin carregam obras. */
export function podeCarregar(u: Usuario | null | undefined): boolean {
  return !!u && (u.admin || u.perfil === "controladoria" || u.perfil === "dp_rh");
}

/** Espelho de pode_projetar (decisão M7): planejamento, engenharia, controladoria e admin. */
export function podeProjetar(u: Usuario | null | undefined): boolean {
  return (
    !!u &&
    (u.admin ||
      u.perfil === "planejamento" ||
      u.perfil === "engenharia" ||
      u.perfil === "controladoria")
  );
}

/** Espelho de pode_aprovar (decisão M7): controladoria, diretoria e admin. */
export function podeAprovar(u: Usuario | null | undefined): boolean {
  return !!u && (u.admin || u.perfil === "controladoria" || u.perfil === "diretoria");
}

/** Espelho de pode_auditar (decisão M10): admin, controladoria e diretoria leem a auditoria. */
export function podeAuditar(u: Usuario | null | undefined): boolean {
  return !!u && (u.admin || u.perfil === "controladoria" || u.perfil === "diretoria");
}

/** Espelho de sou_admin: só admin gere usuários (M10). */
export function podeGerirUsuarios(u: Usuario | null | undefined): boolean {
  return !!u && u.admin;
}
