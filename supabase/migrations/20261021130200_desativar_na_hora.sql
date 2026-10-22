-- M10 (revisão de segurança): desativar vale na hora. O bloqueio do Auth só impede logins novos;
-- o token já emitido valeria até expirar. Por isso: (1) toda leitura exige usuário ativo;
-- (2) a função de usuários encerra as sessões de quem foi desativado.

create function public.sou_ativo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.ativo from public.usuarios u where u.id = auth.uid()), false);
$$;
revoke all on function public.sou_ativo() from public, anon;
grant execute on function public.sou_ativo() to authenticated;

-- leituras abertas a todos os perfis ("using true") passam a exigir usuário ativo
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and qual = 'true'
  loop
    execute format('alter policy %I on public.%I using ((select public.sou_ativo()))',
      p.policyname, p.tablename);
  end loop;
end;
$$;

-- rascunho da carga: o próprio só enquanto ativo (sou_admin já exige ativo)
alter policy ler on public.carga_rascunhos
  using ((usuario_id = (select auth.uid()) and (select public.sou_ativo()))
         or (select public.sou_admin()));

-- encerra as sessões (e os tokens de renovação, em cascata) de quem foi desativado; só a
-- chave de serviço chama (Edge Function usuarios)
create function public.encerrar_sessoes(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = p_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.encerrar_sessoes(uuid) from public, anon, authenticated;
grant execute on function public.encerrar_sessoes(uuid) to service_role;
