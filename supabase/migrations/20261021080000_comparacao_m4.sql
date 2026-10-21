-- Comparação do M4 com o protótipo ITO 2.0: grupo da obra (filtro da Base histórica, PRD §3.1).
-- Deduzido como no protótipo (salvarCarga): Mart Minas + supermercado → mm; galpão → galpao;
-- academia → academia; o resto → outras. (auto — recomendado)

alter table public.obras add column grupo text not null default 'outras'
  check (grupo in ('mm', 'galpao', 'academia', 'outras'));
create index obras_grupo on public.obras (grupo);
comment on column public.obras.grupo is
  'Grupo para filtro: mm (Mart Minas supermercado), galpao, academia, outras. Deduzido de cliente e tipologia.';

create function public.grupo_da_obra()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.grupo := case
    when new.cliente ~* 'mart minas' and new.tipologia ~* 'supermercado' then 'mm'
    when new.tipologia ~* 'galp' then 'galpao'
    when new.tipologia ~* 'academia' then 'academia'
    else 'outras'
  end;
  return new;
end;
$$;
revoke all on function public.grupo_da_obra() from public, anon, authenticated;
create trigger grupo before insert or update of cliente, tipologia on public.obras
  for each row execute function public.grupo_da_obra();
