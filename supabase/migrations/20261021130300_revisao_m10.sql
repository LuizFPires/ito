-- Revisão do M10: autoria das ações da gestão de usuários, cadastros mudados pela carga na
-- auditoria, campos derivados fora da auditoria, política rápida, auditoria imutável também para
-- a chave de serviço e trava na proteção do último admin.

-- quem fez: o usuário logado ou, nas ações da Edge Function (chave de serviço), o admin que chamou
create function public.autor_atual()
returns uuid language sql stable set search_path = '' as $$
  select coalesce(auth.uid(), nullif(current_setting('ito.autor', true), '')::uuid);
$$;
revoke all on function public.autor_atual() from public, anon;
grant execute on function public.autor_atual() to authenticated, service_role;

-- argumentos: módulo, coluna do registro pai, colunas da chave, colunas a ignorar (derivadas)
create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  linha jsonb;
  chave jsonb := '{}';
  ignorar text[] := array['atualizado_em', 'revisao']
    || coalesce(string_to_array(nullif(tg_argv[3], ''), ','), '{}');
  autor uuid := public.autor_atual();
  c text;
begin
  -- na carga, as linhas por mês da obra vêm do arquivo; cadastros que ela muda (sinônimos,
  -- rubricas novas) e a própria obra continuam registrados
  if coalesce(current_setting('ito.carga', true), '') = 'on'
     and tg_table_name in ('competencias', 'obra_feriados', 'obra_regime', 'obra_trocas_tabela') then
    return null;
  end if;
  antes := antes - ignorar;
  depois := depois - ignorar;
  -- atualização sem mudança de conteúdo (carimbo, revisão, campos derivados) não conta
  if tg_op = 'UPDATE' and antes = depois then
    return null;
  end if;
  linha := coalesce(depois, antes);
  foreach c in array string_to_array(tg_argv[2], ',') loop
    chave := chave || jsonb_build_object(c, linha -> c);
  end loop;
  insert into public.auditoria
    (usuario_id, usuario_email, modulo, tabela, ref, registro, operacao, antes, depois)
  values (autor, (select u.email from public.usuarios u where u.id = autor),
          tg_argv[0], tg_table_name, linha ->> tg_argv[1], chave, lower(tg_op), antes, depois);
  return null;
end;
$$;
revoke all on function public.auditar() from public, anon, authenticated;

-- o resumo da projeção é recalculado ao abrir (decisão M7): não é alteração de quem abriu
drop trigger auditoria on public.projecoes;
create trigger auditoria after insert or update or delete on public.projecoes
  for each row execute function public.auditar('projecoes', 'id', 'id', 'resumo');

-- política sem chamar as funções linha a linha
drop policy auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated
  using ((select public.pode_auditar())
         and (modulo <> 'usuarios' or (select public.sou_admin())));

-- ninguém edita nem apaga a auditoria, nem com a chave de serviço
revoke insert, update, delete, truncate on public.auditoria from service_role;
create function public.auditoria_imutavel()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- única mudança aceita: a FK limpa o autor quando a conta some do Auth (o e-mail fica)
  if tg_op = 'UPDATE' and new.usuario_id is null
     and (to_jsonb(new) - 'usuario_id') = (to_jsonb(old) - 'usuario_id') then
    return new;
  end if;
  raise exception 'A auditoria não é alterada nem apagada.' using errcode = '42501';
end;
$$;
revoke all on function public.auditoria_imutavel() from public, anon, authenticated;
create trigger imutavel before update or delete on public.auditoria
  for each row execute function public.auditoria_imutavel();
create trigger imutavel_truncate before truncate on public.auditoria
  for each statement execute function public.auditoria_imutavel();

-- gestão de usuários pela Edge Function: grava com o admin que chamou como autor
create function public.gerir_usuario(p_autor uuid, p_id uuid, p_patch jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform set_config('ito.autor', p_autor::text, true);
  update public.usuarios set
    nome = coalesce(p_patch ->> 'nome', nome),
    perfil = coalesce((p_patch ->> 'perfil')::public.perfil, perfil),
    admin = coalesce((p_patch ->> 'admin')::boolean, admin),
    ativo = coalesce((p_patch ->> 'ativo')::boolean, ativo)
  where id = p_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.gerir_usuario(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gerir_usuario(uuid, uuid, jsonb) to service_role;

-- proteções com o autor certo e sem corrida entre dois admins ao mesmo tempo
create or replace function public.usuarios_antes_de_alterar()
returns trigger language plpgsql set search_path = '' as $$
declare
  autor uuid := public.autor_atual();
begin
  if old.id = autor and old.admin and not new.admin then
    raise exception 'Você não pode remover o seu próprio acesso de administrador. Peça a outro administrador.';
  end if;
  if old.id = autor and old.ativo and not new.ativo then
    raise exception 'Você não pode desativar a si mesmo. Peça a outro administrador.';
  end if;
  if old.admin and old.ativo and not (new.admin and new.ativo) then
    perform pg_advisory_xact_lock(hashtext('ito.ultimo_admin'));
    if not exists (select 1 from public.usuarios u
                   where u.admin and u.ativo and u.id <> old.id) then
      raise exception 'O ITO precisa de pelo menos um administrador ativo. Torne outra pessoa administradora antes.';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke all on function public.usuarios_antes_de_alterar() from public, anon, authenticated;

-- convite pendente = ainda não definiu a senha (abrir o link sem salvar a senha continua pendente)
create or replace function public.listar_usuarios()
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
           a.last_sign_in_at, coalesce(a.encrypted_password, '') = ''
    from public.usuarios u
    left join auth.users a on a.id = u.id
    order by u.ativo desc, lower(u.nome), lower(u.email);
end;
$$;
