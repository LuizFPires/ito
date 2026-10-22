-- Revisão do M0: a função de gatilho não precisa de EXECUTE para os papéis da API.
revoke all on function public.usuarios_antes_de_alterar() from public, anon, authenticated;
