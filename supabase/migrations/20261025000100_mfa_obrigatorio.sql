-- M13 · S02 (auditoria de segurança): MFA obrigatório para administrador, controladoria e
-- diretoria (quem administra e quem aprova). Sem o segundo fator (sessão AAL1), essas contas não
-- leem nem escrevem nada, também pela API: as funções de permissão exigem AAL2 delas. Os demais
-- perfis seguem só com senha.

-- dispensa só para as contas do seed local (só a chave de serviço altera: sem grant de coluna)
alter table public.usuarios add column mfa_dispensado boolean not null default false;
-- quando um admin zerou o MFA da pessoa (fica na auditoria de usuarios)
alter table public.usuarios add column mfa_zerado_em timestamptz;

create function public.mfa_obrigatorio(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (u.admin or u.perfil in ('controladoria', 'diretoria')) and not u.mfa_dispensado
                   from public.usuarios u where u.id = p_id), false);
$$;
revoke all on function public.mfa_obrigatorio(uuid) from public, anon, authenticated;

-- AAL2 (senha + código) ou conta que não precisa de MFA; sem usuário (chave de serviço) = ok
create function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' or not public.mfa_obrigatorio(auth.uid());
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

-- a tela pergunta, ainda em AAL1, se precisa pedir o código
create function public.preciso_de_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.mfa_obrigatorio(auth.uid());
$$;
revoke all on function public.preciso_de_mfa() from public, anon;
grant execute on function public.preciso_de_mfa() to authenticated;

-- toda leitura e escrita passa por estas funções: com elas exigindo o MFA, nada vaza em AAL1
create or replace function public.sou_ativo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.ativo from public.usuarios u where u.id = auth.uid()), false)
         and public.mfa_ok();
$$;

create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin from public.usuarios u where u.id = auth.uid() and u.ativo), false)
         and public.mfa_ok();
$$;

create or replace function public.meu_perfil()
returns public.perfil language sql stable security definer set search_path = '' as $$
  select u.perfil from public.usuarios u where u.id = auth.uid() and u.ativo and public.mfa_ok();
$$;

do $$
declare
  a text;
begin
  foreach a in array array['editar_config', 'editar_cadastros', 'carregar', 'projetar', 'aprovar',
                           'auditar'] loop
    execute format($f$
      create or replace function public.pode_%1$s()
      returns boolean language sql stable security definer set search_path = '' as $b$
        select coalesce((select public.regra(%2$L, u.perfil, u.admin)
                         from public.usuarios u where u.id = auth.uid() and u.ativo), false)
               and public.mfa_ok();
      $b$;
      $f$, a, a);
  end loop;
end;
$$;

-- S06: o autor das ações de usuários precisa ser admin ativo no momento da gravação (a função
-- de usuários confere no início; aqui vale mesmo se ele perdeu o admin no meio)
create or replace function public.gerir_usuario(p_autor uuid, p_id uuid, p_patch jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not exists (select 1 from public.usuarios u where u.id = p_autor and u.admin and u.ativo) then
    raise exception 'Só um administrador ativo gere usuários.' using errcode = '42501';
  end if;
  perform set_config('ito.autor', p_autor::text, true);
  update public.usuarios set
    nome = coalesce(p_patch ->> 'nome', nome),
    perfil = coalesce((p_patch ->> 'perfil')::public.perfil, perfil),
    admin = coalesce((p_patch ->> 'admin')::boolean, admin),
    ativo = coalesce((p_patch ->> 'ativo')::boolean, ativo),
    email = coalesce(nullif(p_patch ->> 'email', ''), email),
    mfa_zerado_em = coalesce((p_patch ->> 'mfa_zerado_em')::timestamptz, mfa_zerado_em)
  where id = p_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- a tela de usuários mostra quem já ativou o segundo fator e quem precisa
drop function public.listar_usuarios();
create function public.listar_usuarios()
returns table (id uuid, email text, nome text, perfil public.perfil, admin boolean,
               ativo boolean, criado_em timestamptz, ultimo_acesso timestamptz,
               convite_pendente boolean, mfa_obrigatorio boolean, mfa_ativo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só um administrador vê a lista de usuários.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email, u.nome, u.perfil, u.admin, u.ativo, u.criado_em,
           a.last_sign_in_at, coalesce(a.encrypted_password, '') = '',
           public.mfa_obrigatorio(u.id),
           exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')
    from public.usuarios u
    left join auth.users a on a.id = u.id
    order by u.ativo desc, lower(u.nome), lower(u.email);
end;
$$;
revoke all on function public.listar_usuarios() from public, anon;
grant execute on function public.listar_usuarios() to authenticated;
