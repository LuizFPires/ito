-- M10 — Tela de usuários: situação (ativo/desativado), lista para o admin com o último acesso,
-- e a tabela de permissões por perfil servida pelo banco a partir da mesma regra das funções
-- pode_* (uma fonte só; o teste de banco confere as duas).

alter table public.usuarios add column ativo boolean not null default true;
comment on column public.usuarios.ativo is
  'Desativado não entra (login bloqueado no Auth) e perde a escrita na hora; a autoria fica.';

-- ── a regra: o que cada perfil pode fazer ───────────────────────────────────
create function public.regra(acao text, p public.perfil, adm boolean)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(adm, false) or case acao
    when 'editar_config' then p = 'controladoria'
    when 'editar_cadastros' then p in ('controladoria', 'dp_rh')
    when 'carregar' then p in ('controladoria', 'dp_rh')
    when 'projetar' then p in ('planejamento', 'engenharia', 'controladoria')
    when 'aprovar' then p in ('controladoria', 'diretoria')
    when 'auditar' then p in ('controladoria', 'diretoria')
    when 'gerir_usuarios' then false
    else false
  end;
$$;
revoke all on function public.regra(text, public.perfil, boolean) from public, anon;
grant execute on function public.regra(text, public.perfil, boolean) to authenticated;

-- as funções das políticas passam a usar a regra e a exigir usuário ativo
create or replace function public.sou_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin from public.usuarios u where u.id = auth.uid() and u.ativo), false);
$$;

create or replace function public.meu_perfil()
returns public.perfil language sql stable security definer set search_path = '' as $$
  select u.perfil from public.usuarios u where u.id = auth.uid() and u.ativo;
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
                         from public.usuarios u where u.id = auth.uid() and u.ativo), false);
      $b$;
      $f$, a, a);
  end loop;
end;
$$;

-- ── tabela de permissões (a tela de usuários mostra) ────────────────────────
create function public.permissoes()
returns table (ordem integer, modulo text, limitacao text, perfil text, admin boolean,
               le boolean, edita boolean, aprova boolean, so_totais boolean)
language sql stable security definer set search_path = '' as $$
  with modulos (ordem, modulo, leitura, escrita, aprovacao, totais, limitacao) as (values
    (1, 'Base histórica e detalhe da obra', null, 'carregar', null, null,
        'Editar premissas e ausências da obra: quem carrega.'),
    (2, 'Folha por matrícula', 'carregar', null, null, 'todos',
        'Quem não carrega vê só os totais da obra (LGPD).'),
    (3, 'Carga de dados', null, 'carregar', null, null,
        'Gravar ou substituir uma obra na base.'),
    (4, 'Cidades e CCTs', null, 'editar_config', null, null, null),
    (5, 'Parâmetros (tabela da empresa)', null, 'editar_config', null, null,
        'Data-base revisada e fora de vigência fica travada para todos.'),
    (6, 'Funções padrão', null, 'editar_cadastros', null, null, null),
    (7, 'Rubricas da folha', null, 'editar_cadastros', null, null, null),
    (8, 'Projeções', null, 'projetar', null, null,
        'Projeção aprovada não é editada por ninguém.'),
    (9, 'Aprovação de projeções', null, null, 'aprovar', null, null),
    (10, 'Exportações (.xlsx, PDF, copiar)', null, null, null, null,
         'Exporta o que lê; as rubricas por matrícula só para quem carrega.'),
    (11, 'Auditoria', 'auditar', null, null, null,
         'Ninguém edita nem apaga a auditoria.'),
    (12, 'Usuários', 'gerir_usuarios', 'gerir_usuarios', null, null,
         'O admin não tira o próprio acesso nem desativa a si mesmo.')
  ),
  perfis (perfil, admin) as (
    select e.enumlabel, false from pg_catalog.pg_enum e
    where e.enumtypid = 'public.perfil'::regtype
    union all select null, true
  )
  select m.ordem, m.modulo, m.limitacao, p.perfil, p.admin,
    m.leitura is null or public.regra(m.leitura, p.perfil::public.perfil, p.admin),
    m.escrita is not null and public.regra(m.escrita, p.perfil::public.perfil, p.admin),
    m.aprovacao is not null and public.regra(m.aprovacao, p.perfil::public.perfil, p.admin),
    m.totais is not null
      and not (m.leitura is null or public.regra(m.leitura, p.perfil::public.perfil, p.admin))
  from modulos m cross join perfis p
  order by m.ordem, p.admin, p.perfil;
$$;
revoke all on function public.permissoes() from public, anon;
grant execute on function public.permissoes() to authenticated;

-- ── lista de usuários para o admin (com o último acesso, que fica no Auth) ──
create function public.listar_usuarios()
returns table (id uuid, email text, nome text, perfil public.perfil, admin boolean,
               ativo boolean, criado_em timestamptz, ultimo_acesso timestamptz,
               convite_pendente boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só um administrador vê a lista de usuários.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email, u.nome, u.perfil, u.admin, u.ativo, u.criado_em,
           a.last_sign_in_at, a.email_confirmed_at is null and a.last_sign_in_at is null
    from public.usuarios u
    left join auth.users a on a.id = u.id
    order by u.ativo desc, lower(u.nome), lower(u.email);
end;
$$;
revoke all on function public.listar_usuarios() from public, anon;
grant execute on function public.listar_usuarios() to authenticated;

-- ── proteções: ninguém desativa a si mesmo; sempre fica um admin ativo ──────
create or replace function public.usuarios_antes_de_alterar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.id = auth.uid() and old.admin and not new.admin then
    raise exception 'Você não pode remover o seu próprio acesso de administrador. Peça a outro administrador.';
  end if;
  if old.id = auth.uid() and old.ativo and not new.ativo then
    raise exception 'Você não pode desativar a si mesmo. Peça a outro administrador.';
  end if;
  if old.admin and old.ativo and not (new.admin and new.ativo)
     and not exists (select 1 from public.usuarios u
                     where u.admin and u.ativo and u.id <> old.id) then
    raise exception 'O ITO precisa de pelo menos um administrador ativo. Torne outra pessoa administradora antes.';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function public.usuarios_antes_de_alterar() from public, anon, authenticated;

-- a auditoria de usuários (e-mail, nome, perfil) segue a RLS de usuarios: só o admin lê
drop policy auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.pode_auditar() and (modulo <> 'usuarios' or public.sou_admin()));
