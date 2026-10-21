-- M0 — Usuários e perfis do ITO.
-- Usuários do sistema (equipe da Clássica), não trabalhadores das obras: trabalhadores
-- só existem por matrícula (CLAUDE.md, regra 2).

create type public.perfil as enum ('planejamento', 'engenharia', 'dp_rh', 'controladoria', 'diretoria');

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text not null default '',
  perfil public.perfil not null default 'engenharia',
  admin boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.usuarios is 'Usuários do ITO (equipe). Um perfil por usuário; admin gere usuários.';

alter table public.usuarios enable row level security;

-- Funções auxiliares para as políticas (security definer evita recursão na RLS).
create function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.admin from public.usuarios u where u.id = auth.uid()), false);
$$;

create function public.meu_perfil()
returns public.perfil
language sql
stable
security definer
set search_path = ''
as $$
  select u.perfil from public.usuarios u where u.id = auth.uid();
$$;

revoke all on function public.sou_admin() from public, anon;
revoke all on function public.meu_perfil() from public, anon;
grant execute on function public.sou_admin() to authenticated;
grant execute on function public.meu_perfil() to authenticated;

-- Acesso: anônimo não vê nada; cada um lê a própria linha; admin lê e altera todas.
revoke all on table public.usuarios from anon, authenticated;
grant select on table public.usuarios to authenticated;
grant update (nome, perfil, admin) on table public.usuarios to authenticated;

create policy usuarios_ler_proprio on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()) or (select public.sou_admin()));

create policy usuarios_admin_altera on public.usuarios
  for update to authenticated
  using ((select public.sou_admin()))
  with check ((select public.sou_admin()));

-- Admin não tira o próprio acesso de admin (evita ficar sem ninguém para gerir usuários).
create function public.usuarios_antes_de_alterar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = auth.uid() and old.admin and not new.admin then
    raise exception 'Você não pode remover o seu próprio acesso de administrador. Peça a outro administrador.';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger usuarios_antes_de_alterar
  before update on public.usuarios
  for each row execute function public.usuarios_antes_de_alterar();

-- Toda conta criada no Auth (por convite) ganha a linha em usuarios.
-- Perfil e admin vêm de app_metadata, que só o servidor (service role) define.
create function public.criar_usuario_do_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := new.raw_app_meta_data ->> 'perfil';
begin
  insert into public.usuarios (id, email, nome, perfil, admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when p in ('planejamento', 'engenharia', 'dp_rh', 'controladoria', 'diretoria')
      then p::public.perfil else 'engenharia'::public.perfil end,
    coalesce((new.raw_app_meta_data ->> 'admin')::boolean, false)
  );
  return new;
end;
$$;

revoke all on function public.criar_usuario_do_auth() from public, anon, authenticated;

create trigger criar_usuario_do_auth
  after insert on auth.users
  for each row execute function public.criar_usuario_do_auth();
