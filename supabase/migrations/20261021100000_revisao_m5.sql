-- Revisão do M5.
-- 1. Troca de tabela editada na obra precisa cair dentro do período (do 2º mês ao último).

create function public.troca_no_periodo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.mes_idx >= (select meses from public.obras where id = new.obra_id) then
    raise exception 'A troca de tabela precisa cair dentro do período da obra. Escolha outro mês.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.troca_no_periodo() from public, anon, authenticated;
create trigger no_periodo before insert or update on public.obra_trocas_tabela
  for each row execute function public.troca_no_periodo();

-- 2. Revisão da obra: cada edição incrementa; o resumo só é gravado se foi calculado sobre a
--    revisão atual (quem leu antes de outra pessoa editar não grava resumo velho como novo).
alter table public.obras add column revisao integer not null default 0;

create function public.obra_nova_revisao()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revisao := old.revisao + 1;
  return new;
end;
$$;
revoke all on function public.obra_nova_revisao() from public, anon, authenticated;
create trigger revisao before update on public.obras
  for each row when (old.revisao = new.revisao) execute function public.obra_nova_revisao();

-- filhas: invalidam o resumo e dão nova revisão à obra
create or replace function public.resumo_desatualizado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_obra text := coalesce(new.obra_id, old.obra_id);
begin
  update public.obra_resumo set versao = 0 where obra_id = v_obra;
  update public.obras set revisao = revisao + 1 where id = v_obra;
  return null;
end;
$$;
-- a carga grava as filhas junto com a obra (revisão 0 + incrementos): não importa, o resumo nasce depois

-- 3. Impressão digital dos parâmetros usados no cálculo (tabelas, funções, benefícios,
--    calendário): editar qualquer cadastro torna o resumo desatualizado.
alter table public.obra_resumo add column contexto text not null default '';
alter table public.obra_resumo add column revisao integer not null default 0;
alter table public.obra_resumo add constraint obra_resumo_nao_negativo check (
  pico >= 0 and pessoa_mes >= 0 and he_por_pessoa >= 0 and indireta_pct between 0 and 100
  and custo_epoca >= 0 and custo_atual >= 0);

create or replace function public.gravar_resumos(p jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not (public.pode_carregar() or public.pode_editar_config()) then
    raise exception 'Só DP/RH, controladoria ou um administrador atualiza o resumo das obras.'
      using errcode = '42501';
  end if;
  insert into public.obra_resumo (obra_id, vigente, versao, contexto, revisao, pico, pessoa_mes,
    he_por_pessoa, indireta_pct, custo_epoca, custo_atual, histograma, atualizado_em)
  select x.obra_id, x.vigente, coalesce(x.versao, 1), coalesce(x.contexto, ''), x.revisao, x.pico,
    x.pessoa_mes, x.he_por_pessoa, x.indireta_pct, x.custo_epoca, x.custo_atual,
    coalesce(x.histograma, '{}'), now()
  from jsonb_populate_recordset(null::public.obra_resumo, coalesce(p, '[]')) x
  -- só a revisão que o cliente leu (outra pessoa pode ter editado a obra no meio do cálculo)
  where exists (select 1 from public.obras o where o.id = x.obra_id and o.revisao = x.revisao)
  on conflict (obra_id) do update set
    vigente = excluded.vigente, versao = excluded.versao, contexto = excluded.contexto,
    revisao = excluded.revisao, pico = excluded.pico, pessoa_mes = excluded.pessoa_mes,
    he_por_pessoa = excluded.he_por_pessoa, indireta_pct = excluded.indireta_pct,
    custo_epoca = excluded.custo_epoca, custo_atual = excluded.custo_atual,
    histograma = excluded.histograma, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 4. Funções transferidas editadas na obra precisam existir (como em gravar_carga).
create function public.transferidas_existem()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.funcoes_transferidas) x
             where not exists (select 1 from public.funcoes f where f.id = x)) then
    raise exception 'Função transferida sem cadastro. Escolha funções padrão.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.transferidas_existem() from public, anon, authenticated;
create trigger transferidas before insert or update of funcoes_transferidas on public.obras
  for each row execute function public.transferidas_existem();
