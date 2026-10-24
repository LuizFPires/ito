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

/**
 * Erro da gravação da carga (`gravar_carga`): as mensagens próprias do banco dizem a etapa a
 * corrigir; as genéricas viram o que costuma causá-las numa carga.
 */
export function mensagemErroCarga(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string };
  const msg = err.message ?? "";
  if (
    /etapa|verificação|período|substituição|Já existe uma obra|Lance |Reabra|Envie a folha/i.test(
      msg,
    )
  )
    return msg;
  switch (err.code) {
    case "23505":
      return /obras_nome/i.test(msg)
        ? "Já existe uma obra com esse nome. Use outro nome na etapa Obra."
        : "Há registro repetido na carga (a mesma nota fiscal ou rubrica duas vezes). Confira os arquivos.";
    case "23503":
      return "A cidade, a data-base ou a justificativa escolhida não existe mais. Atualize a página e escolha de novo.";
    case "23514":
      return "Há valor fora do permitido na carga (negativo, acima de 100% ou matrícula sem número). Confira os arquivos.";
  }
  return mensagemErroBanco(e);
}
