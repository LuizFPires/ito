-- M1 — Carga inicial (valores do protótipo ITO 2.0; decisão M1).
-- Encargos = AF v07 (reais). Salários e benefícios são ilustrativos: datas-base marcadas a_revisar.
-- Gerado a partir de docs/prototipo/ITO_2.0.html. Fatores de HE: SPEC §4.3.

insert into public.funcoes (id, nome, grupo, conta_pc, escala_area, vinculo, cor, exame_adm, exame_per_anual, exame_dem, peric_pct, insal_pct_sm, horas_noturnas_mes, ferramentas_mes, fator_he) values
  ('ped', 'Pedreiro', 'direta', '04.03.15', true, 'clt', 'd1', 195, 137, 195, 0, 0, 0, 60, 1.1),
  ('carp', 'Carpinteiro', 'direta', '04.03.18', true, 'clt', 'd2', 205, 144, 205, 0, 0, 0, 90, 1.2),
  ('arm', 'Armador', 'direta', '04.03.19', true, 'clt', 'd3', 200, 140, 200, 0, 0, 0, 60, 1.2),
  ('serv', 'Servente', 'direta', '04.03.16', true, 'clt', 'd4', 245, 172, 245, 0, 0, 0, 0, 0.9),
  ('eletr', 'Eletricista', 'direta', '04.03.20', true, 'clt', 'd5', 170, 119, 170, 30, 0, 0, 80, 1.1),
  ('opg', 'Operador de guincho', 'direta', '04.03.21', false, 'clt', 'd6', 150, 105, 150, 0, 20, 0, 0, 1),
  ('mestre', 'Mestre de obras', 'indireta', '04.03.04', false, 'clt', 'i1', 175, 122, 175, 0, 0, 0, 0, 0.4),
  ('encar', 'Encarregado', 'indireta', '04.03.05', true, 'clt', 'i2', 185, 130, 185, 0, 0, 0, 0, 1.3),
  ('tecseg', 'Técnico de segurança', 'indireta', '04.03.13', false, 'clt', 'i3', 200, 140, 200, 0, 0, 0, 0, 0.5),
  ('almox', 'Almoxarife', 'indireta', '04.03.09', false, 'clt', 'i4', 73, 51, 73, 0, 0, 0, 0, 0.6),
  ('auxeng', 'Auxiliar de engenharia', 'indireta', '04.03.03', false, 'clt', 'i5', 60, 42, 60, 0, 0, 0, 0, 0.5),
  ('vigia', 'Vigia', 'indireta', '04.03.22', false, 'clt', 'i6', 60, 42, 60, 0, 0, 80, 0, 0.8),
  ('admin', 'Analista administrativo', 'adm', '04.03.11', false, 'clt', 'm1', 50, 35, 50, 0, 0, 0, 0, 0.3),
  ('estag', 'Estagiário', 'adm', '04.03.12', false, 'estagio', 'm2', 0, 0, 0, 0, 0, 0, 0, 0);

insert into public.funcao_sinonimos (texto, funcao_id) values
  ('PEDREIRO', 'ped'),
  ('MEIO OFICIAL PEDREIRO', 'ped'),
  ('CARPINTEIRO', 'carp'),
  ('CARPINTEIRO FORMA', 'carp'),
  ('CARPINTEIRO DE OBRAS', 'carp'),
  ('ARMADOR', 'arm'),
  ('SERVENTE', 'serv'),
  ('AJUDANTE GERAL', 'serv'),
  ('ELETRICISTA', 'eletr'),
  ('OPERADOR DE GUINCHO', 'opg'),
  ('MESTRE DE OBRAS', 'mestre'),
  ('MESTRE DE OBRA', 'mestre'),
  ('ENCARREGADO CIVIL', 'encar'),
  ('ENCARREGADO DE OBRAS', 'encar'),
  ('TECNICO DE SEGURANÇA DO TRABALHO', 'tecseg'),
  ('ALMOXARIFE', 'almox'),
  ('AUXILIAR DE ALMOXARIFE', 'almox'),
  ('AUXILIAR DE ENGENHARIA', 'auxeng'),
  ('ASSISTENTE DE ENGENHARIA', 'auxeng'),
  ('TECNICO DE EDIFICACOES', 'auxeng'),
  ('VIGIA', 'vigia'),
  ('ANALISTA ADMINISTATIVO', 'admin'),
  ('AUXILIAR ADMINISTRATIVO', 'admin'),
  ('ESTAGIARIO', 'estag'),
  ('ESTAGIÁRIO DE ENGENHARIA', 'estag');

insert into public.rubricas (codigo, nome, tipo, componente, base_provisoes) values
  (1, 'HORAS NORMAIS', 'provento', 'sal', true),
  (300, 'BOLSA ESTÁGIO', 'provento', 'sal', false),
  (20, 'GRATIFICAÇÕES', 'provento', 'extras', true),
  (149, 'PERICULOSIDADE 30%', 'provento', 'extras', true),
  (155, 'INSALUBRIDADE', 'provento', 'extras', true),
  (160, 'ADICIONAL NOTURNO', 'provento', 'extras', true),
  (161, 'DSR S/ ADICIONAL NOTURNO', 'provento', 'extras', true),
  (170, 'ADICIONAL DE TRANSFERÊNCIA 25%', 'provento', 'extras', true),
  (2126, 'PRÊMIO', 'provento', 'extras', true),
  (2127, 'PRÊMIO DE PRODUÇÃO', 'provento', 'extras', true),
  (200, 'HORAS EXTRAS 100%', 'provento', 'he', true),
  (201, 'HORAS EXTRAS SÁBADO 100%', 'provento', 'he', true),
  (205, 'INTERVALO INTRAJORNADA 50%', 'provento', 'he', true),
  (210, 'HORAS EXTRAS FERIADO 100%', 'provento', 'he', true),
  (250, 'REFLEXO EXTRAS DSR', 'provento', 'dsr', true),
  (251, 'REFLEXO EXTRAS DSR (DEMITIDOS)', 'provento', 'dsr', true),
  (252, 'DIFERENÇA DSR MÊS ANTERIOR', 'provento', 'dsr', true),
  (310, 'DEPRECIAÇÃO DE FERRAMENTAS', 'provento', 'ferr', false),
  (400, 'FÉRIAS GOZADAS', 'provento', 'provpaga', false),
  (401, '1/3 FÉRIAS GOZADAS', 'provento', 'provpaga', false),
  (320, 'SALÁRIO-FAMÍLIA', 'provento', 'compgps', false),
  (980, 'ADIANTAMENTO SALARIAL (DIA 20)', 'informativo', 'info', false),
  (990, 'ARREDONDAMENTO', 'informativo', 'info', false),
  (40, 'HORAS FALTAS', 'desconto', 'faltas', true),
  (42, 'HORAS FALTAS DSR', 'desconto', 'faltas', true),
  (8697, 'HORAS AFAST. P/ DOENÇA C/ DIR. INTEGRAIS', 'provento', 'sal', true),
  (29, 'FÉRIAS PROPORCIONAIS', 'provento', 'resc', false),
  (8169, '1/3 FÉRIAS PROPORCIONAIS RESCISÃO', 'provento', 'resc', false),
  (8550, '13º SALÁRIO INTEGRAL RESCISÃO', 'provento', 'resc', false),
  (831, 'MULTA ESTABILIDADE ART. 479/CLT', 'provento', 'resc', false),
  (51, 'LÍQUIDO RESCISÃO', 'informativo', 'info', false),
  (981, 'DESCONTO ADIANTAMENTO SALARIAL', 'informativo', 'info', false),
  (998, 'I.N.S.S.', 'desconto', 'nao', false),
  (999, 'IMPOSTO DE RENDA', 'desconto', 'nao', false),
  (2003, 'VALE TRANSPORTE 6%', 'desconto', 'nao', false),
  (2005, 'DESCONTO CESTA BÁSICA', 'desconto', 'nao', false),
  (2505, 'DESC. CAFÉ DA MANHÃ', 'desconto', 'nao', false),
  (2402, 'DESCONTO NEGOCIAL 1,00%', 'desconto', 'nao', false);

insert into public.beneficios (id, nome, conta_pc, so_fora_sede, ordem) values
  ('refeicao', 'Refeição', '04.02.04', false, 1),
  ('cafe', 'Café da manhã', '04.02.04', false, 2),
  ('cesta', 'Cesta básica', '04.02.06', false, 3),
  ('seguro', 'Seguro de vida', '04.02.11', false, 4),
  ('aloj', 'Alojamento / república', '04.02.10', true, 5),
  ('viagem', 'Viagens periódicas', '04.02.08', true, 6);

insert into public.datas_base (ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo, he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct, vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota) values (2023, true, 100, 100, 50, 100, 220, 'calendario', false, 22, 20, 9.6, 0.9, 1320, 20, 1754.18, 59.82);
insert into public.data_base_salarios (ano, funcao_id, valor) values (2023, 'mestre', 3900), (2023, 'encar', 2800), (2023, 'ped', 1100), (2023, 'carp', 1100), (2023, 'arm', 1100), (2023, 'serv', 880), (2023, 'eletr', 1500), (2023, 'opg', 1250), (2023, 'tecseg', 3000), (2023, 'almox', 1800), (2023, 'auxeng', 2200), (2023, 'vigia', 1150), (2023, 'admin', 2300), (2023, 'estag', 1000);
insert into public.data_base_beneficios (ano, beneficio_id, valor) values (2023, 'refeicao', 185), (2023, 'cafe', 38), (2023, 'cesta', 92), (2023, 'seguro', 8), (2023, 'aloj', 134), (2023, 'viagem', 50);
insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem) values
  (2023, 'inss', 'soc', 'INSS', 100, 20, 0, 1),
  (2023, 'sat', 'soc', 'Seguro acidente de trabalho (SAT)', 100, 3, 0, 2),
  (2023, 'fgts', 'soc', 'FGTS', 100, 8, 0, 3),
  (2023, 'sesi', 'soc', 'SESI / SESC', 100, 1.5, 0, 4),
  (2023, 'senai', 'soc', 'SENAI / SENAC', 100, 1, 0, 5),
  (2023, 'saled', 'soc', 'Salário-educação', 100, 2.5, 0, 6),
  (2023, 'incra', 'soc', 'INCRA', 100, 0.2, 0, 7),
  (2023, 'sebrae', 'soc', 'SEBRAE', 100, 0.6, 0, 8),
  (2023, 'seconci', 'soc', 'SECONCI', 100, 0, 0, 9),
  (2023, 'ferias', 'prov', 'Férias', 100, 8.3333, 0, 10),
  (2023, 'terco', 'prov', '1/3 de férias', 100, 2.7778, 0, 11),
  (2023, 'dec', 'prov', '13º salário', 100, 8.3333, 0, 12),
  (2023, 'grrf', 'prov', 'Multa do FGTS (GRRF)', 8, 40, 0, 13),
  (2023, 'iss', 'nf', 'ISSQN', 100, 0, 3, 14),
  (2023, 'pis', 'nf', 'PIS', 100, 0, 0.65, 15),
  (2023, 'cofins', 'nf', 'COFINS', 100, 0, 3, 16),
  (2023, 'cprb', 'nf', 'Contrib. previdenciária s/ receita bruta', 100, 0, 0, 17);

insert into public.datas_base (ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo, he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct, vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota) values (2024, true, 100, 100, 50, 100, 220, 'calendario', false, 22, 20, 10.4, 0.9, 1412, 20, 1819.26, 62.04);
insert into public.data_base_salarios (ano, funcao_id, valor) values (2024, 'mestre', 4200), (2024, 'encar', 3000), (2024, 'ped', 1200), (2024, 'carp', 1200), (2024, 'arm', 1200), (2024, 'serv', 950), (2024, 'eletr', 1620), (2024, 'opg', 1350), (2024, 'tecseg', 3250), (2024, 'almox', 1950), (2024, 'auxeng', 2400), (2024, 'vigia', 1240), (2024, 'admin', 2500), (2024, 'estag', 1100);
insert into public.data_base_beneficios (ano, beneficio_id, valor) values (2024, 'refeicao', 196), (2024, 'cafe', 40), (2024, 'cesta', 98), (2024, 'seguro', 9), (2024, 'aloj', 142), (2024, 'viagem', 53);
insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem) values
  (2024, 'inss', 'soc', 'INSS', 100, 20, 0, 1),
  (2024, 'sat', 'soc', 'Seguro acidente de trabalho (SAT)', 100, 3, 0, 2),
  (2024, 'fgts', 'soc', 'FGTS', 100, 8, 0, 3),
  (2024, 'sesi', 'soc', 'SESI / SESC', 100, 1.5, 0, 4),
  (2024, 'senai', 'soc', 'SENAI / SENAC', 100, 1, 0, 5),
  (2024, 'saled', 'soc', 'Salário-educação', 100, 2.5, 0, 6),
  (2024, 'incra', 'soc', 'INCRA', 100, 0.2, 0, 7),
  (2024, 'sebrae', 'soc', 'SEBRAE', 100, 0.6, 0, 8),
  (2024, 'seconci', 'soc', 'SECONCI', 100, 0, 0, 9),
  (2024, 'ferias', 'prov', 'Férias', 100, 8.3333, 0, 10),
  (2024, 'terco', 'prov', '1/3 de férias', 100, 2.7778, 0, 11),
  (2024, 'dec', 'prov', '13º salário', 100, 8.3333, 0, 12),
  (2024, 'grrf', 'prov', 'Multa do FGTS (GRRF)', 8, 40, 0, 13),
  (2024, 'iss', 'nf', 'ISSQN', 100, 0, 3, 14),
  (2024, 'pis', 'nf', 'PIS', 100, 0, 0.65, 15),
  (2024, 'cofins', 'nf', 'COFINS', 100, 0, 3, 16),
  (2024, 'cprb', 'nf', 'Contrib. previdenciária s/ receita bruta', 100, 0, 0, 17);

insert into public.datas_base (ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo, he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct, vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota) values (2025, true, 100, 100, 50, 100, 220, 'calendario', false, 22, 20, 11, 0.9, 1518, 20, 1906.04, 65);
insert into public.data_base_salarios (ano, funcao_id, valor) values (2025, 'mestre', 4500), (2025, 'encar', 3250), (2025, 'ped', 1300), (2025, 'carp', 1300), (2025, 'arm', 1300), (2025, 'serv', 1030), (2025, 'eletr', 1750), (2025, 'opg', 1450), (2025, 'tecseg', 3500), (2025, 'almox', 2100), (2025, 'auxeng', 2600), (2025, 'vigia', 1330), (2025, 'admin', 2700), (2025, 'estag', 1200);
insert into public.data_base_beneficios (ano, beneficio_id, valor) values (2025, 'refeicao', 207), (2025, 'cafe', 42), (2025, 'cesta', 103), (2025, 'seguro', 9), (2025, 'aloj', 150), (2025, 'viagem', 56);
insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem) values
  (2025, 'inss', 'soc', 'INSS', 100, 20, 0, 1),
  (2025, 'sat', 'soc', 'Seguro acidente de trabalho (SAT)', 100, 3, 0, 2),
  (2025, 'fgts', 'soc', 'FGTS', 100, 8, 0, 3),
  (2025, 'sesi', 'soc', 'SESI / SESC', 100, 1.5, 0, 4),
  (2025, 'senai', 'soc', 'SENAI / SENAC', 100, 1, 0, 5),
  (2025, 'saled', 'soc', 'Salário-educação', 100, 2.5, 0, 6),
  (2025, 'incra', 'soc', 'INCRA', 100, 0.2, 0, 7),
  (2025, 'sebrae', 'soc', 'SEBRAE', 100, 0.6, 0, 8),
  (2025, 'seconci', 'soc', 'SECONCI', 100, 0, 0, 9),
  (2025, 'ferias', 'prov', 'Férias', 100, 8.3333, 0, 10),
  (2025, 'terco', 'prov', '1/3 de férias', 100, 2.7778, 0, 11),
  (2025, 'dec', 'prov', '13º salário', 100, 8.3333, 0, 12),
  (2025, 'grrf', 'prov', 'Multa do FGTS (GRRF)', 8, 40, 0, 13),
  (2025, 'iss', 'nf', 'ISSQN', 100, 0, 3, 14),
  (2025, 'pis', 'nf', 'PIS', 100, 0, 0.65, 15),
  (2025, 'cofins', 'nf', 'COFINS', 100, 0, 3, 16),
  (2025, 'cprb', 'nf', 'Contrib. previdenciária s/ receita bruta', 100, 0, 0, 17);

insert into public.datas_base (ano, a_revisar, he_adicional_util, he_adicional_sabado, he_adicional_intervalo, he_adicional_feriado, divisor, modo_dias, sabado_trabalhado, dias_fixos, dsr_fixo_pct, vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct, sf_teto, sf_cota) values (2026, true, 100, 100, 50, 100, 220, 'calendario', false, 22, 20, 11.6, 0.9, 1621, 20, 1980.38, 67.54);
insert into public.data_base_salarios (ano, funcao_id, valor) values (2026, 'mestre', 4900), (2026, 'encar', 3500), (2026, 'ped', 1400), (2026, 'carp', 1400), (2026, 'arm', 1400), (2026, 'serv', 1110), (2026, 'eletr', 1880), (2026, 'opg', 1560), (2026, 'tecseg', 3800), (2026, 'almox', 2250), (2026, 'auxeng', 2800), (2026, 'vigia', 1430), (2026, 'admin', 2900), (2026, 'estag', 1300);
insert into public.data_base_beneficios (ano, beneficio_id, valor) values (2026, 'refeicao', 220), (2026, 'cafe', 45), (2026, 'cesta', 110), (2026, 'seguro', 10), (2026, 'aloj', 160), (2026, 'viagem', 60);
insert into public.data_base_encargos (ano, id, grupo, nome, base_calc_pct, aliq_clt, aliq_sp, ordem) values
  (2026, 'inss', 'soc', 'INSS', 100, 20, 0, 1),
  (2026, 'sat', 'soc', 'Seguro acidente de trabalho (SAT)', 100, 3, 0, 2),
  (2026, 'fgts', 'soc', 'FGTS', 100, 8, 0, 3),
  (2026, 'sesi', 'soc', 'SESI / SESC', 100, 1.5, 0, 4),
  (2026, 'senai', 'soc', 'SENAI / SENAC', 100, 1, 0, 5),
  (2026, 'saled', 'soc', 'Salário-educação', 100, 2.5, 0, 6),
  (2026, 'incra', 'soc', 'INCRA', 100, 0.2, 0, 7),
  (2026, 'sebrae', 'soc', 'SEBRAE', 100, 0.6, 0, 8),
  (2026, 'seconci', 'soc', 'SECONCI', 100, 0, 0, 9),
  (2026, 'ferias', 'prov', 'Férias', 100, 8.3333, 0, 10),
  (2026, 'terco', 'prov', '1/3 de férias', 100, 2.7778, 0, 11),
  (2026, 'dec', 'prov', '13º salário', 100, 8.3333, 0, 12),
  (2026, 'grrf', 'prov', 'Multa do FGTS (GRRF)', 8, 40, 0, 13),
  (2026, 'iss', 'nf', 'ISSQN', 100, 0, 3, 14),
  (2026, 'pis', 'nf', 'PIS', 100, 0, 0.65, 15),
  (2026, 'cofins', 'nf', 'COFINS', 100, 0, 3, 16),
  (2026, 'cprb', 'nf', 'Contrib. previdenciária s/ receita bruta', 100, 0, 0, 17);

insert into public.parametros (id, data_base_vigente, carnaval, corpus_christi) values (true, 2026, false, true);
