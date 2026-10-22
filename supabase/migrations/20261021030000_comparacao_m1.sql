-- Comparação do M1 com o protótipo (decisões de 21/10/2026, CLAUDE.md).
-- 1) Só a data-base vigente e as "a revisar" são editáveis; as revisadas fora de vigência
--    ficam travadas (protegem o custo "época" das obras).
-- 2) Nova data-base é sempre cópia da vigente (+ reajuste em centavos).
-- 3) Função nova nasce como no protótipo: salário do oficial (pedreiro) nas data-bases
--    editáveis, conta 04.03.99, exames 150/105/150, escala ligada se direta, cor própria.

-- ── 1) data-base editável ────────────────────────────────────────────────────
create function public.data_base_editavel(p_ano integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select d.a_revisar or d.ano = (select p.data_base_vigente from public.parametros p)
     from public.datas_base d where d.ano = p_ano),
    true); -- ano ainda não existe (sendo criado)
$$;
revoke all on function public.data_base_editavel(integer) from public, anon;
grant execute on function public.data_base_editavel(integer) to authenticated;

create function public.travar_data_base_revisada()
returns trigger language plpgsql set search_path = '' as $$
declare
  a integer := case when tg_op = 'DELETE' then old.ano else new.ano end;
begin
  -- Só a própria tabela datas_base olha o estado anterior (marcar como revisada é permitido).
  if tg_table_name = 'datas_base' then
    if tg_op = 'UPDATE' and (old.a_revisar or old.ano = (select data_base_vigente from public.parametros)) then
      return new;
    end if;
    if tg_op = 'DELETE' and old.a_revisar then
      return old;
    end if;
  end if;
  if tg_table_name <> 'datas_base' and public.data_base_editavel(a) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' and tg_table_name = 'datas_base' then
    return new;
  end if;
  raise exception 'A data-base % já foi revisada e não é a vigente: os valores dela estão travados.', a
    using errcode = '42501',
          hint = 'Para mudar valores, crie uma nova data-base ou torne esta a vigente.';
end;
$$;
revoke all on function public.travar_data_base_revisada() from public, anon, authenticated;

create trigger travar_revisada before insert or update or delete on public.data_base_salarios
  for each row execute function public.travar_data_base_revisada();
create trigger travar_revisada before insert or update or delete on public.data_base_beneficios
  for each row execute function public.travar_data_base_revisada();
create trigger travar_revisada before insert or update or delete on public.data_base_encargos
  for each row execute function public.travar_data_base_revisada();
create trigger travar_revisada before update or delete on public.datas_base
  for each row execute function public.travar_data_base_revisada();

-- ── 2) nova data-base = cópia da vigente ─────────────────────────────────────
drop function public.criar_data_base(integer, integer, numeric);

create function public.criar_data_base(p_ano integer, p_reajuste_pct numeric)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  origem integer := (select data_base_vigente from public.parametros);
  fator numeric := 1 + coalesce(p_reajuste_pct, 0) / 100;
begin
  if not public.pode_editar_config() then
    raise exception 'Só a controladoria ou um administrador cria data-base.' using errcode = '42501';
  end if;
  if p_reajuste_pct is not null and (p_reajuste_pct < -50 or p_reajuste_pct > 100) then
    raise exception 'Informe um reajuste entre -50%% e 100%%.' using errcode = '22023';
  end if;
  if exists (select 1 from public.datas_base where ano = p_ano) then
    raise exception 'A data-base % já existe. Escolha outro ano.', p_ano using errcode = '23505';
  end if;
  if origem is null then
    raise exception 'Não há data-base vigente para copiar. Escolha a vigente em Parâmetros.'
      using errcode = '23503';
  end if;

  insert into public.datas_base (
    ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo,
    he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct,
    vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota,
    criado_de, reajuste_pct)
  select p_ano, true, he_adicional_util, he_adicional_sabado, he_adicional_intervalo,
    he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct,
    vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota,
    origem, coalesce(p_reajuste_pct, 0)
  from public.datas_base where ano = origem;

  insert into public.data_base_salarios (ano, funcao_id, valor)
  select p_ano, funcao_id, round(valor * fator, 2) from public.data_base_salarios where ano = origem;

  insert into public.data_base_beneficios (ano, beneficio_id, valor)
  select p_ano, beneficio_id, round(valor * fator, 2) from public.data_base_beneficios where ano = origem;

  insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem)
  select p_ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem
  from public.data_base_encargos where ano = origem;

  return p_ano;
end;
$$;

revoke all on function public.criar_data_base(integer, numeric) from public, anon;
grant execute on function public.criar_data_base(integer, numeric) to authenticated;

-- ── 3) função nova com os padrões do protótipo ───────────────────────────────
drop function public.criar_funcao(text, text, public.grupo_funcao, text);

-- security definer: DP/RH cria a função e o salário inicial de oficial (que é dado de
-- config) é copiado aqui dentro. A permissão é checada no início.
create function public.criar_funcao(p_id text, p_nome text, p_grupo public.grupo_funcao,
  p_sinonimo text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  dono text;
  sin text := nullif(upper(trim(coalesce(p_sinonimo, ''))), '');
  cor text;
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

  -- cor: a menos usada entre as cores extras do protótipo (não repete a das funções da carga)
  select c into cor from unnest(array['m2', 'x1', 'x2', 'c11', 'c10']) with ordinality as t(c, ordem)
    order by (select count(*) from public.funcoes f where f.cor = t.c), ordem limit 1;

  insert into public.funcoes (id, nome, grupo, conta_pc, escala_area, cor,
    exame_adm, exame_per_anual, exame_dem)
  values (p_id, trim(p_nome), p_grupo, '04.03.99', p_grupo = 'direta', cor, 150, 105, 150);

  if sin is not null then
    insert into public.funcao_sinonimos (texto, funcao_id) values (sin, p_id);
  end if;

  -- salário inicial = oficial (pedreiro), só nas data-bases editáveis
  insert into public.data_base_salarios (ano, funcao_id, valor)
  select s.ano, p_id, s.valor from public.data_base_salarios s
  where s.funcao_id = 'ped' and public.data_base_editavel(s.ano);

  return p_id;
end;
$$;

revoke all on function public.criar_funcao(text, text, public.grupo_funcao, text) from public, anon;
grant execute on function public.criar_funcao(text, text, public.grupo_funcao, text) to authenticated;
