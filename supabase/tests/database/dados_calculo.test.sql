begin;
select plan(5);

-- M14: dados_calculo_obras lista as colunas de competencias e efetivo_mes à mão (formato
-- compacto). Coluna nova numa dessas tabelas = atualizar a função e o carregador da tela.
select is(array(select column_name::text from information_schema.columns
                where table_schema = 'public' and table_name = 'competencias' order by ordinal_position),
  array['obra_id', 'mes_idx', 'he_media', 'absenteismo_pct', 'licenca_pessoa_dias',
        'ferias_pessoa_dias', 'ito_apropriado', 'erp_realizado', 'justificativa'],
  'colunas de competencias = as de dados_calculo_obras');
select is(array(select column_name::text from information_schema.columns
                where table_schema = 'public' and table_name = 'efetivo_mes' order by ordinal_position),
  array['obra_id', 'funcao_id', 'mes_idx', 'equivalente', 'cabecas', 'admissoes', 'desligamentos'],
  'colunas de efetivo_mes = as de dados_calculo_obras');

-- uma obra com um lançamento (como admin do seed)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.gravar_carga($j${"obra": {"id": "dc_obra", "nome": "Obra Dados", "area_m2": 1000,
  "inicio": "2025-03-01", "meses": 1, "data_base": 2025}, "competencias": [{"mes_idx": 0}],
  "lancamentos": [{"mes_idx": 0, "matricula": "101", "funcao_id": "ped", "equivalente": 1,
  "rubricas": [{"codigo": 1, "referencia": 220, "valor": 1650}]}]}$j$::jsonb);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(json_array_length(public.dados_calculo_obras(array['dc_obra']) -> 'efetivo'), 1,
  'quem está ativo lê o efetivo compacto');
-- sem login ativo, a RLS esvazia tudo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000ff","role":"authenticated"}', true);
select is(json_array_length(public.dados_calculo_obras(array['dc_obra']) -> 'obras'), 0,
  'sem cadastro ativo, nada volta (RLS de quem lê)');
select throws_ok($$select public.dados_calculo_obras(array(select g::text from generate_series(1, 1001) g))$$,
  '54000', null, 'no máximo 1.000 obras por chamada');

select * from finish();
rollback;
