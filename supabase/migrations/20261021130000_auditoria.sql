-- M10 — Auditoria: quem alterou parâmetros, CCTs, cidades, premissas da obra, projeções e
-- usuários, com a versão anterior e a nova. Grava só o banco (gatilho); ninguém edita nem apaga.
-- Lançamentos por matrícula ficam fora (LGPD); a carga registra só a obra gravada.

create function public.pode_auditar()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select u.admin or u.perfil in ('controladoria', 'diretoria')
                   from public.usuarios u where u.id = auth.uid()), false);
$$;
revoke all on function public.pode_auditar() from public, anon;
grant execute on function public.pode_auditar() to authenticated;

create table public.auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid references auth.users (id) on delete set null,
  usuario_email text,
  modulo text not null,
  tabela text not null,
  -- registro "pai" no módulo (obra, CCT, cidade, data-base, projeção…), para o histórico do detalhe
  ref text,
  registro jsonb not null,
  operacao text not null check (operacao in ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb
);
comment on table public.auditoria is
  'Alterações de configuração, obras, projeções e usuários (M10). Só o gatilho auditar() grava.';

create index auditoria_em on public.auditoria (em desc);
create index auditoria_modulo on public.auditoria (modulo, em desc);
create index auditoria_ref on public.auditoria (modulo, ref, em desc);
create index auditoria_usuario on public.auditoria (usuario_id, em desc);

alter table public.auditoria enable row level security;
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.pode_auditar());
revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate on public.auditoria from authenticated;
grant select on public.auditoria to authenticated;

-- argumentos: módulo, coluna do registro pai, colunas da chave (separadas por vírgula)
create function public.auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  linha jsonb := coalesce(depois, antes);
  chave jsonb := '{}';
  c text;
begin
  -- dentro da carga, só a obra (as linhas por mês e por matrícula vêm do arquivo)
  if coalesce(current_setting('ito.carga', true), '') = 'on' and tg_table_name <> 'obras' then
    return null;
  end if;
  -- atualização sem mudança de conteúdo (só carimbo de data ou revisão) não conta
  if tg_op = 'UPDATE'
     and (antes - 'atualizado_em' - 'revisao') = (depois - 'atualizado_em' - 'revisao') then
    return null;
  end if;
  foreach c in array string_to_array(tg_argv[2], ',') loop
    chave := chave || jsonb_build_object(c, linha -> c);
  end loop;
  insert into public.auditoria
    (usuario_id, usuario_email, modulo, tabela, ref, registro, operacao, antes, depois)
  values (auth.uid(), (select u.email from public.usuarios u where u.id = auth.uid()),
          tg_argv[0], tg_table_name, linha ->> tg_argv[1], chave, lower(tg_op), antes, depois);
  return null;
end;
$$;
revoke all on function public.auditar() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('parametros', 'datas_base', 'ano', 'ano'),
      ('parametros', 'data_base_salarios', 'ano', 'ano,funcao_id'),
      ('parametros', 'data_base_beneficios', 'ano', 'ano,beneficio_id'),
      ('parametros', 'data_base_encargos', 'ano', 'ano,id'),
      ('parametros', 'parametros', 'id', 'id'),
      ('parametros', 'beneficios', 'id', 'id'),
      ('parametros', 'feriados_empresa', 'data', 'data'),
      ('funcoes', 'funcoes', 'id', 'id'),
      ('funcoes', 'funcao_sinonimos', 'funcao_id', 'texto'),
      ('rubricas', 'rubricas', 'codigo', 'codigo'),
      ('ccts', 'ccts', 'id', 'id'),
      ('ccts', 'cct_salarios', 'cct_id', 'cct_id,funcao_id'),
      ('ccts', 'cct_beneficios', 'cct_id', 'cct_id,beneficio_id'),
      ('ccts', 'cct_gratificacoes', 'cct_id', 'cct_id,funcao_id'),
      ('cidades', 'cidades', 'id', 'id'),
      ('cidades', 'cidade_feriados', 'cidade_id', 'cidade_id,mes,dia'),
      ('cidades', 'cidade_passagens', 'cidade_id', 'cidade_id,origem_id'),
      ('obras', 'obras', 'id', 'id'),
      ('obras', 'competencias', 'obra_id', 'obra_id,mes_idx'),
      ('obras', 'obra_feriados', 'obra_id', 'obra_id,data'),
      ('obras', 'obra_regime', 'obra_id', 'obra_id,funcao_id'),
      ('obras', 'obra_trocas_tabela', 'obra_id', 'obra_id,mes_idx'),
      ('projecoes', 'projecoes', 'id', 'id'),
      ('usuarios', 'usuarios', 'id', 'id')
    ) as x (modulo, tabela, ref, chave)
  loop
    execute format(
      'create trigger auditoria after insert or update or delete on public.%I
         for each row execute function public.auditar(%L, %L, %L)',
      t.tabela, t.modulo, t.ref, t.chave);
  end loop;
end;
$$;

-- a carga grava centenas de linhas por obra: marca a transação para o gatilho registrar só a obra.
-- Atenção: uma revisão futura do gravar_carga deve alterar gravar_carga_dados, não este invólucro.
alter function public.gravar_carga(jsonb) rename to gravar_carga_dados;
revoke all on function public.gravar_carga_dados(jsonb) from public, anon, authenticated;

create function public.gravar_carga(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  id text;
begin
  perform set_config('ito.carga', 'on', true);
  id := public.gravar_carga_dados(p);
  perform set_config('ito.carga', '', true);
  return id;
end;
$$;
revoke all on function public.gravar_carga(jsonb) from public, anon;
grant execute on function public.gravar_carga(jsonb) to authenticated;

-- excluir a obra registra só a obra apagada (as linhas por mês vão junto, em cascata)
create or replace function public.excluir_obra(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_carga();
  perform set_config('ito.carga', 'on', true);
  delete from public.obras where id = p_id;
  if not found then
    raise exception 'A obra não existe. Atualize a página.' using errcode = 'P0002';
  end if;
  perform set_config('ito.carga', '', true);
end;
$$;
