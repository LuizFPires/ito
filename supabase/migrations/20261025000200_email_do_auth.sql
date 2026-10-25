-- M13 · S03 (auditoria de segurança): o e-mail do cadastro acompanha o do Auth. Antes, só a
-- criação copiava o e-mail; uma troca no Auth deixava public.usuarios com o endereço antigo (tela,
-- auditoria e envio de link). A função de usuários passa a resolver a conta pelo UUID no Auth.
create function public.sincronizar_email_do_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    perform set_config('ito.autor', new.id::text, true);
    update public.usuarios set email = coalesce(new.email, '') where id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function public.sincronizar_email_do_auth() from public, anon, authenticated;

create trigger sincronizar_email_do_auth
  after update of email on auth.users
  for each row execute function public.sincronizar_email_do_auth();
