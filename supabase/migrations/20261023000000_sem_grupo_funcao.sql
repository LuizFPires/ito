-- Decisão do usuário (23/10/2026): o ITO não classifica mais as funções em direta, indireta e
-- administrativa. O custo não muda: crescer com a área na projeção continua no campo
-- escala_area de cada função (era só o padrão de quem nascia "direta").

-- criar função: escala com a área informada direto (padrão: sim, como a "direta" de antes)
drop function public.criar_funcao(text, text, public.grupo_funcao, text);

create function public.criar_funcao(p_id text, p_nome text, p_escala_area boolean default true,
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

  insert into public.funcoes (id, nome, conta_pc, escala_area, cor,
    exame_adm, exame_per_anual, exame_dem)
  values (p_id, trim(p_nome), '04.03.99', coalesce(p_escala_area, true), cor, 150, 105, 150);

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

revoke all on function public.criar_funcao(text, text, boolean, text) from public, anon;
grant execute on function public.criar_funcao(text, text, boolean, text) to authenticated;

alter table public.funcoes drop column grupo;
drop type public.grupo_funcao;

-- resumo da obra sem a % indireta
alter table public.obra_resumo drop constraint obra_resumo_nao_negativo;
alter table public.obra_resumo drop column indireta_pct;
alter table public.obra_resumo add constraint obra_resumo_nao_negativo check (
  pico >= 0 and pessoa_mes >= 0 and he_por_pessoa >= 0 and custo_epoca >= 0 and custo_atual >= 0);

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
    he_por_pessoa, custo_epoca, custo_atual, histograma, atualizado_em)
  select x.obra_id, x.vigente, coalesce(x.versao, 1), coalesce(x.contexto, ''), x.revisao, x.pico,
    x.pessoa_mes, x.he_por_pessoa, x.custo_epoca, x.custo_atual,
    coalesce(x.histograma, '{}'), now()
  from jsonb_populate_recordset(null::public.obra_resumo, coalesce(p, '[]')) x
  -- só a revisão que o cliente leu (outra pessoa pode ter editado a obra no meio do cálculo)
  where exists (select 1 from public.obras o where o.id = x.obra_id and o.revisao = x.revisao)
  on conflict (obra_id) do update set
    vigente = excluded.vigente, versao = excluded.versao, contexto = excluded.contexto,
    revisao = excluded.revisao, pico = excluded.pico, pessoa_mes = excluded.pessoa_mes,
    he_por_pessoa = excluded.he_por_pessoa,
    custo_epoca = excluded.custo_epoca, custo_atual = excluded.custo_atual,
    histograma = excluded.histograma, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end;
$$;
