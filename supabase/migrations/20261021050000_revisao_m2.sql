-- Revisão do M2.
-- 1) Apagar uma cidade não apaga as passagens de outras cidades que vêm dela (restrict).
-- 2) Ajuste em lote vale para tudo o que a tela mostra: funções ativas que ainda usam o
--    salário da empresa ganham linha própria (empresa vigente × fator). CCT inexistente é erro.
--    O ajuste carimba a CCT (quem alterou e quando).

alter table public.cidade_passagens drop constraint cidade_passagens_origem_id_fkey;
alter table public.cidade_passagens
  add constraint cidade_passagens_origem_id_fkey
  foreign key (origem_id) references public.cidades (id) on delete restrict;

create or replace function public.ajustar_cct(p_cct text, p_pct numeric)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  fator numeric := 1 + p_pct / 100;
  vig integer := (select data_base_vigente from public.parametros);
  n_upd integer;
  n_ins integer;
begin
  perform public.exigir_config();
  if p_pct is null or p_pct < -50 or p_pct > 100 then
    raise exception 'Informe um ajuste entre -50%% e 100%%.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ccts where id = p_cct) then
    raise exception 'A convenção não existe mais. Atualize a página.' using errcode = '23503';
  end if;

  -- 1) valores próprios da CCT
  update public.cct_salarios set valor = round(valor * fator, 2) where cct_id = p_cct;
  get diagnostics n_upd = row_count;
  update public.cct_gratificacoes set valor = round(valor * fator, 2) where cct_id = p_cct;

  -- 2) funções ativas que usavam o salário da empresa: passam a ter valor próprio, ajustado
  insert into public.cct_salarios (cct_id, funcao_id, valor)
  select p_cct, s.funcao_id, round(s.valor * fator, 2)
  from public.data_base_salarios s
  join public.funcoes f on f.id = s.funcao_id and f.ativo
  where s.ano = vig
    and not exists (select 1 from public.cct_salarios c where c.cct_id = p_cct and c.funcao_id = s.funcao_id);
  get diagnostics n_ins = row_count;

  -- 3) carimbo da CCT
  update public.ccts set reajuste_estimado_pct = reajuste_estimado_pct where id = p_cct;

  return n_upd + n_ins;
end;
$$;
