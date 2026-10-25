-- M14 (desempenho): dados de cálculo de várias obras numa resposta só. Com 1.000 obras de
-- referência, o efetivo tinha 160 mil linhas e o PostgREST entrega 1.000 por pedido: abrir o
-- histograma levava ~180 pedidos. Aqui o efetivo vem compacto (uma lista por obra e função, com
-- os meses junto) e a tela remonta as mesmas linhas de antes; nada muda no cálculo.
-- json (não jsonb) e array_agg sem ordenar: 1.000 obras em ~0,3 s no banco, 2,8 MB.
-- Security invoker: vale a RLS de quem lê (sou_ativo, com o segundo fator).

create function public.dados_calculo_obras(p_ids text[])
returns json language plpgsql stable security invoker set search_path = '' as $$
begin
  if cardinality(p_ids) > 1000 then
    raise exception 'Peça até 1.000 obras por vez.' using errcode = '54000';
  end if;
  return json_build_object(
    'obras', coalesce((select json_agg(o) from public.obras o
                       where o.id in (select unnest(p_ids))), '[]'),
    -- [obra, mês, HE média, absenteísmo, licenças, férias, apropriado, ERP, justificativa]
    -- (teste de banco confere que são todas as colunas de competencias)
    'competencias', coalesce((
      select json_agg(json_build_array(c.obra_id, c.mes_idx, c.he_media, c.absenteismo_pct,
                                       c.licenca_pessoa_dias, c.ferias_pessoa_dias,
                                       c.ito_apropriado, c.erp_realizado, c.justificativa))
      from public.competencias c where c.obra_id in (select unnest(p_ids))), '[]'),
    -- [obra, função, meses, equivalente, cabeças, admissões, desligamentos] (mesma posição)
    'efetivo', coalesce((
      select json_agg(json_build_array(x.obra_id, x.funcao_id, x.m, x.e, x.c, x.a, x.d))
      from (select e.obra_id, e.funcao_id, array_agg(e.mes_idx) m, array_agg(e.equivalente) e,
                   array_agg(e.cabecas) c, array_agg(e.admissoes) a, array_agg(e.desligamentos) d
            from public.efetivo_mes e where e.obra_id in (select unnest(p_ids))
            group by e.obra_id, e.funcao_id) x), '[]'),
    'regime', coalesce((select json_agg(r) from public.obra_regime r
                        where r.obra_id in (select unnest(p_ids))), '[]'),
    'trocas', coalesce((select json_agg(t) from public.obra_trocas_tabela t
                        where t.obra_id in (select unnest(p_ids))), '[]'),
    'feriados', coalesce((select json_agg(f) from public.obra_feriados f
                          where f.obra_id in (select unnest(p_ids))), '[]')
  );
end;
$$;
revoke all on function public.dados_calculo_obras(text[]) from public, anon;
grant execute on function public.dados_calculo_obras(text[]) to authenticated;
