-- Revisão do M1.
-- 1) Carimbo: o "revoke update (atualizado_em, atualizado_por)" não valia, porque havia
--    grant de UPDATE na tabela inteira. Agora o UPDATE é concedido por coluna, sem o carimbo.
-- 2) Carimbo também nos valores da tabela da empresa e nos feriados (quem alterou e quando).
-- 3) Criar função + sinônimo numa transação só (criar_funcao).

-- ── carimbo nas tabelas que não tinham ───────────────────────────────────────
alter table public.data_base_salarios
  add column atualizado_em timestamptz not null default now(),
  add column atualizado_por uuid references auth.users (id) on delete set null;
alter table public.data_base_beneficios
  add column atualizado_em timestamptz not null default now(),
  add column atualizado_por uuid references auth.users (id) on delete set null;
alter table public.data_base_encargos
  add column atualizado_em timestamptz not null default now(),
  add column atualizado_por uuid references auth.users (id) on delete set null;
alter table public.feriados_empresa
  add column atualizado_em timestamptz not null default now(),
  add column atualizado_por uuid references auth.users (id) on delete set null;

create trigger carimbar before insert or update on public.data_base_salarios
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.data_base_beneficios
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.data_base_encargos
  for each row execute function public.carimbar_alteracao();
create trigger carimbar before insert or update on public.feriados_empresa
  for each row execute function public.carimbar_alteracao();

-- ── UPDATE por coluna (carimbo e chaves fora) ────────────────────────────────
revoke update on public.funcoes, public.rubricas, public.datas_base, public.parametros,
  public.data_base_salarios, public.data_base_beneficios, public.data_base_encargos,
  public.feriados_empresa, public.funcao_sinonimos, public.beneficios from authenticated;

grant update (nome, grupo, conta_pc, escala_area, vinculo, cor, exame_adm, exame_per_anual,
  exame_dem, peric_pct, insal_pct_sm, horas_noturnas_mes, ferramentas_mes, fator_he, ativo)
  on public.funcoes to authenticated;
grant update (nome, tipo, componente, base_provisoes, ativo) on public.rubricas to authenticated;
grant update (a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo,
  he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct,
  vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota)
  on public.datas_base to authenticated;
grant update (data_base_vigente, carnaval, corpus_christi) on public.parametros to authenticated;
-- upsert do PostgREST reescreve as colunas da chave com o mesmo valor
grant update (ano, funcao_id, valor) on public.data_base_salarios to authenticated;
grant update (ano, beneficio_id, valor) on public.data_base_beneficios to authenticated;
grant update (nome, base_calc_pct, aliq_clt, aliq_sp, ordem) on public.data_base_encargos to authenticated;
grant update (nome) on public.feriados_empresa to authenticated;
grant update (funcao_id) on public.funcao_sinonimos to authenticated;
grant update (nome, conta_pc, so_fora_sede, ordem) on public.beneficios to authenticated;

-- ── criar função + sinônimo (atômico) ────────────────────────────────────────
create function public.criar_funcao(p_id text, p_nome text, p_grupo public.grupo_funcao,
  p_sinonimo text default null)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dono text;
  sin text := nullif(upper(trim(coalesce(p_sinonimo, ''))), '');
begin
  if not public.pode_editar_cadastros() then
    raise exception 'Só a controladoria ou o DP/RH cria função.' using errcode = '42501';
  end if;
  if sin is not null then
    select f.nome into dono from public.funcao_sinonimos s join public.funcoes f on f.id = s.funcao_id
      where s.texto = sin;
    if dono is not null then
      raise exception 'O sinônimo "%" já está na função %. Use outro texto.', sin, dono
        using errcode = '23505';
    end if;
  end if;
  insert into public.funcoes (id, nome, grupo) values (p_id, trim(p_nome), p_grupo);
  if sin is not null then
    insert into public.funcao_sinonimos (texto, funcao_id) values (sin, p_id);
  end if;
  return p_id;
end;
$$;

revoke all on function public.criar_funcao(text, text, public.grupo_funcao, text) from public, anon;
grant execute on function public.criar_funcao(text, text, public.grupo_funcao, text) to authenticated;
