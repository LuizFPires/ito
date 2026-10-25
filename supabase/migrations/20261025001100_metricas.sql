-- M14 (monitoramento próprio, em vez do Vercel Speed Insights): tempos de tela (Web Vitals,
-- abrir o histograma e o resultado da projeção) e erros da tela, gravados sem dado pessoal: sem
-- usuário, rota sem ids, erro só com a mensagem e o arquivo. 90 dias; só o administrador lê.

create table public.metricas_tela (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('vital', 'tempo', 'erro')),
  nome text not null check (length(nome) between 1 and 60),
  valor numeric check (valor is null or valor between 0 and 3600000),
  rota text not null default '' check (length(rota) <= 120),
  versao text not null default '' check (length(versao) <= 40),
  detalhe text not null default '' check (length(detalhe) <= 300)
);
create index metricas_tela_nome on public.metricas_tela (nome, criado_em desc);
create index metricas_tela_criado on public.metricas_tela (criado_em);
alter table public.metricas_tela enable row level security;
-- sem política nem grant: grava por registrar_metricas, lê por resumo_metricas e erros_tela

-- a tela manda em lotes de até 50; até 600 por hora por pessoa (o excesso some calado)
create function public.registrar_metricas(p json)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.sou_ativo() then
    raise exception 'Entre no ITO de novo.' using errcode = '42501';
  end if;
  if p is null or json_typeof(p) <> 'array' or json_array_length(p) > 50 then
    raise exception 'Pedido inválido.' using errcode = '22023';
  end if;
  if not public.usar_cota(auth.uid(), 'metricas', 600 / 50, '1 hour') then
    return 0;
  end if;
  insert into public.metricas_tela (tipo, nome, valor, rota, versao, detalhe)
  select x.tipo, left(x.nome, 60), x.valor, left(coalesce(x.rota, ''), 120),
         left(coalesce(x.versao, ''), 40), left(coalesce(x.detalhe, ''), 300)
  from json_to_recordset(p) as x(tipo text, nome text, valor numeric, rota text, versao text,
                                 detalhe text)
  where x.tipo in ('vital', 'tempo', 'erro') and length(coalesce(x.nome, '')) > 0
    and (x.valor is null or x.valor between 0 and 3600000);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.registrar_metricas(json) from public, anon;
grant execute on function public.registrar_metricas(json) to authenticated;

-- percentis por métrica no período (administrador)
create function public.resumo_metricas(p_dias integer default 7)
returns table (tipo text, nome text, n bigint, p50 numeric, p75 numeric, p95 numeric,
               ultimo timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só um administrador vê o desempenho.' using errcode = '42501';
  end if;
  return query
    select m.tipo, m.nome, count(*),
           round(percentile_cont(0.5) within group (order by m.valor)::numeric, 3),
           round(percentile_cont(0.75) within group (order by m.valor)::numeric, 3),
           round(percentile_cont(0.95) within group (order by m.valor)::numeric, 3),
           max(m.criado_em)
    from public.metricas_tela m
    where m.criado_em > now() - make_interval(days => least(greatest(p_dias, 1), 90))
      and m.tipo <> 'erro'
    group by m.tipo, m.nome
    order by m.tipo, m.nome;
end;
$$;
revoke all on function public.resumo_metricas(integer) from public, anon;
grant execute on function public.resumo_metricas(integer) to authenticated;

-- erros da tela mais recentes, agrupados pela mensagem (administrador)
create function public.erros_tela(p_dias integer default 7)
returns table (detalhe text, rota text, versao text, vezes bigint, ultimo timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só um administrador vê o desempenho.' using errcode = '42501';
  end if;
  return query
    select m.detalhe, m.rota, m.versao, count(*), max(m.criado_em)
    from public.metricas_tela m
    where m.tipo = 'erro'
      and m.criado_em > now() - make_interval(days => least(greatest(p_dias, 1), 90))
    group by m.detalhe, m.rota, m.versao
    order by max(m.criado_em) desc
    limit 100;
end;
$$;
revoke all on function public.erros_tela(integer) from public, anon;
grant execute on function public.erros_tela(integer) to authenticated;

-- 90 dias
create function public.limpar_metricas_antigas()
returns void language sql security definer set search_path = '' as $$
  delete from public.metricas_tela where criado_em < now() - interval '90 days';
$$;
revoke all on function public.limpar_metricas_antigas() from public, anon, authenticated;
select cron.schedule('limpar-metricas-antigas', '30 3 * * *', 'select public.limpar_metricas_antigas()');
