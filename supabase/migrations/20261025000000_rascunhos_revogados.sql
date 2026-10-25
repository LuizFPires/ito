-- M13 · S01 (auditoria de segurança): o rascunho da carga guarda dados por matrícula. Quem perde o
-- perfil de carga (ex.: DP/RH vira engenharia) deixa de ler e de apagar os próprios rascunhos,
-- como já acontece com as tabelas definitivas da folha. Admin ativo continua vendo todos.
alter policy ler on public.carga_rascunhos
  using ((usuario_id = (select auth.uid()) and (select public.pode_carregar()))
         or (select public.sou_admin()));
alter policy apagar on public.carga_rascunhos
  using ((usuario_id = (select auth.uid()) and (select public.pode_carregar()))
         or (select public.sou_admin()));

-- retenção: rascunho parado há mais de 90 dias é apagado (todo dia, 03:00 UTC)
create function public.limpar_rascunhos_antigos()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.carga_rascunhos where atualizado_em < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.limpar_rascunhos_antigos() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('limpar-rascunhos-antigos', '0 3 * * *', 'select public.limpar_rascunhos_antigos()');
