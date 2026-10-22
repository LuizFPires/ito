/** Traduz os erros do Supabase Auth para a interface, dizendo o que fazer. */
export function mensagemDeErro(codigo: string | undefined, msg: string): string {
  if (codigo === "invalid_credentials")
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (codigo === "email_not_confirmed")
    return "Confirme o seu e-mail pelo link do convite antes de entrar.";
  if (codigo === "user_banned")
    return "Seu acesso ao ITO foi desativado. Fale com um administrador.";
  if (codigo === "weak_password")
    return "Senha fraca: use pelo menos 8 caracteres, misturando letras e números.";
  if (codigo === "same_password") return "Escolha uma senha diferente da atual.";
  if (codigo === "over_request_rate_limit" || codigo === "over_email_send_rate_limit")
    return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (/fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet.";
  return "Não foi possível entrar. Tente de novo ou fale com a controladoria.";
}
