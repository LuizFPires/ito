-- M4 — Coluna "Obras" em Funções (pendente do M1 até haver histórico): em quantas obras da base
-- cada função teve efetivo. View com security_invoker: vale a RLS de quem consulta.

create view public.funcao_obras with (security_invoker = true) as
  select funcao_id, count(distinct obra_id)::integer as obras
  from public.efetivo_mes
  where equivalente > 0
  group by funcao_id;

revoke all on public.funcao_obras from anon, authenticated;
grant select on public.funcao_obras to authenticated;
