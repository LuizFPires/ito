/** Erro do PostgREST/Postgres → frase que diz o que fazer (regra de tom do CLAUDE.md). */
export function mensagemErroBanco(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string };
  const msg = err.message ?? "";
  switch (err.code) {
    case "42501":
      return "Você não tem permissão para alterar isto. Peça à controladoria.";
    case "23505":
      return /data-base|sinônimo|substituição/i.test(msg)
        ? msg
        : "Já existe um cadastro com esse código ou nome. Use outro.";
    case "23503":
      return /origem|etapa/i.test(msg)
        ? msg
        : "Este cadastro está em uso e não pode ser apagado. Inative-o.";
    case "23514":
      return /código da função/i.test(msg)
        ? msg
        : "Valor fora do permitido. Confira os campos e tente de novo.";
    case "22023":
    case "23502":
      return msg;
    case "SEM_LINHAS":
      return "Nada foi gravado: você não tem permissão ou o registro mudou. Atualize a página.";
    case "PGRST116":
      return "Registro não encontrado. Atualize a página.";
  }
  if (/fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet.";
  return "Não foi possível salvar. Tente de novo; se continuar, avise a controladoria.";
}
