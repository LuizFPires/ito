-- M13 (pendência da auditoria do ITO; S12 do JETO): tabela, função ou sequência nova no schema
-- public nascia com acesso total para anon e authenticated (privilégios padrão do Supabase), e
-- cada migração precisava lembrar de revogar. Agora nasce fechada: quem cria concede o que a tela
-- usa (grant explícito) e liga a RLS. Os objetos que já existem mantêm as permissões de hoje.
-- Teste: supabase/tests/database/privilegios.test.sql.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
-- o EXECUTE para public é padrão global do Postgres (o do schema só soma): revogado também ali
alter default privileges for role postgres
  revoke execute on functions from public;
