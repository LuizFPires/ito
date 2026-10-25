-- M14 · S07 (auditoria de segurança): cota por usuário e ação nas Edge Functions (convites de
-- usuários: até 20 por hora por administrador). Só a chave de serviço usa; cada uso conta, também
-- o que falhar depois, para tentativas em série não escaparem do limite.

create table public.cotas (
  usuario_id uuid not null,
  acao text not null check (length(acao) between 1 and 40),
  em timestamptz not null default now()
);
create index cotas_usuario_acao on public.cotas (usuario_id, acao, em desc);
alter table public.cotas enable row level security;
-- sem política nem grant: só a chave de serviço (usar_cota) lê e grava

create function public.usar_cota(p_usuario uuid, p_acao text, p_maximo integer, p_janela interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  -- uma pessoa por vez (dois pedidos juntos não passam os dois do limite)
  perform pg_advisory_xact_lock(hashtext(p_usuario::text || ':' || p_acao));
  delete from public.cotas
    where usuario_id = p_usuario and acao = p_acao and em < now() - greatest(p_janela, interval '1 day');
  select count(*) into n from public.cotas
    where usuario_id = p_usuario and acao = p_acao and em > now() - p_janela;
  if n >= p_maximo then
    return false;
  end if;
  insert into public.cotas (usuario_id, acao) values (p_usuario, p_acao);
  return true;
end;
$$;
revoke all on function public.usar_cota(uuid, text, integer, interval) from public, anon, authenticated;
grant execute on function public.usar_cota(uuid, text, integer, interval) to service_role;
