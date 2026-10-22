# ITO — SPEC (modelo de dados e regras de cálculo)

> Versão 2.0 · outubro/2026. Este documento é a fonte de verdade das fórmulas. O motor do protótipo **ITO 2.0** implementa exatamente o que está aqui. Os **testes de referência** (§8) devem passar antes de qualquer entrega que mexa no motor.

---

## 1. Modelo de dados

### 1.1 Configuração

```
Funcao        { id, nome, grupo: direta|indireta|adm, conta_pc, escala_area: bool,
                vinculo: clt|estagio, cor,
                exames: { adm, per_anual, dem },            -- R$ por evento / ano
                adicionais: { peric_pct, insal_pct_sm, horas_noturnas_mes },
                ferramentas_mes,                            -- R$ por pessoa·mês (indenizatória)
                sinonimos: [texto da folha] }

Rubrica       { codigo, nome, tipo: provento|desconto|informativo,
                componente: sal|extras|he|dsr|faltas|resc|ferr|provpaga|compgps|nao|info,
                base_provisoes: bool }

TabelaEmpresa { data_base (ano), salarios {funcao: R$}, beneficios {beneficio: R$},
                encargos: [ { id, grupo: soc|prov|nf, nome, base_calc_pct, aliq_clt, aliq_sp } ],
                he: { adicional_util, adicional_sabado, adicional_intervalo, adicional_feriado, divisor },
                modo_dias: calendario|fixo, sabado_trabalhado: bool, dias_fixos, dsr_fixo_pct,
                vt_diaria_ref, fator_rescisao, salario_minimo, adicional_noturno_pct,
                salario_familia: { teto, cota } }
Parametros    { data_base_vigente, calendario: { carnaval: bool, corpus_christi: bool,
                feriados_empresa: [ {data, nome} ] } }

CCT           { id, nome, mes_data_base (0–11 no protótipo; 1–12 no banco, ver nota M2), reajuste_estimado_pct,
                salarios {funcao: R$}, gratificacoes {funcao: R$/mês}, beneficios {beneficio: R$} }
Cidade        { id, nome/UF, cct_id, tarifa_local, conducoes_por_trajeto, iss_pct,
                feriados: [ {dd-mm, nome} ],                -- recorrentes todo ano
                passagem_de: { cidade_id: R$ por trajeto } }
```

> **Implementação (M1):** tabelas `funcoes` (+ `fator_he`, `ativo`), `funcao_sinonimos`, `rubricas` (+ `ativo`), `beneficios`, `datas_base` com filhas `data_base_salarios`, `data_base_beneficios` e `data_base_encargos`, `parametros` (linha única) e `feriados_empresa`. Percentuais de 0 a 100. Calendário e taxas de encargos: `packages/motor` (`calendario.ts`, `encargos.ts`).

> **Implementação (M2):** `ccts` (mês da data-base 1–12), `cct_salarios`, `cct_gratificacoes`, `cct_beneficios` (função ou benefício sem valor na CCT usa a tabela da empresa vigente); `cidades` (nome + UF), `cidade_feriados` (dia + mês, recorrentes) e `cidade_passagens` (por cidade de origem). VT e feriados da cidade: `packages/motor/src/local.ts`.

### 1.2 Base histórica (por obra)

```
Obra          { id, nome, cliente, grupo, tipologia, cidade_id, area_m2, inicio (1º dia do mês), meses,
                data_base, trocas_tabela: [ { mes_idx, data_base, motivo } ],
                feriados_municipais: [ {data, nome} ],
                premissas: { grat_premios_pct, transf_pct, funcoes_transferidas[], risco_pct, lucro_pct,
                             trib_lucro_pct, fora_da_sede, provisionar, adiantamento: bool, adiantamento_pct },
                regime: { funcao: clt|sp }, rotatividade_pct_mes,
                he_mix: { util, sabado, intervalo, feriado },  -- soma 100%
                erp_diferenca[mes], justificativas{mes} }

Competencia   (obra, mes_idx) { horas_extras_media, absenteismo_pct,
                licenca_pessoa_dias, ferias_pessoa_dias }
EfetivoMes    (obra, funcao, mes_idx) { equivalente, cabecas }
Lancamento    (obra, matricula, funcao, mes_idx) { equivalente, horas_extras, faltas, desligado, sem_vt, rubricas{codigo: R$} }
Realocacao    (obra) { tipo: cedida|recebida, funcao, mes_ini, mes_fim, qtd, outra_obra, saldo_vt }
```

> **Implementação (M4):** `obras` (período por competência: `inicio` no 1º dia do mês + `meses`; a fração do 1º e do último mês vem dos dias de vínculo da folha; `grupo` deduzido de cliente e tipologia; premissas em colunas), `obra_trocas_tabela`, `obra_feriados`, `obra_regime` (só S/P), `competencias` (+ `ito_apropriado`, `erp_realizado`, `justificativa` da lista `justificativas_erp`), `efetivo_mes` (+ `admissoes`, `desligamentos`; derivado dos lançamentos na gravação, sem a MDO realocada), `lancamentos` (+ `faltas_horas`, `licenca_dias`, `ferias_dias`, `admitido`, `vt_valor`, `realocada_para`) com `lancamento_rubricas` (`referencia`, `valor`), `realocacoes`, `notas_fiscais` (só CNPJ), `erp_realizado` (mês × conta) e `carga_rascunhos`. `rubricas.tipo_he` diz o tipo de cada rubrica de HE. Escrita só por `gravar_carga(jsonb)` e `excluir_obra`; todo mês do payload é conferido contra o período. Lançamentos e rubricas por matrícula só são lidos por quem carrega (DP/RH, controladoria, admin); os demais perfis leem os agregados.

### 1.3 Projeção

```
Projecao      { id, nome, cliente, tipologia, cidade_id, inicio (mês/ano), prazo_meses, area_m2,
                referencias[obra_id], estatistica: media|mediana, ajustes{funcao: %},
                quantidades_manuais{funcao: [n por mês]} | null,
                he_override, absenteismo, rotatividade, licenca_por_pm, ferias_por_pm, he_mix | null,
                premissas{…como Obra}, regime{funcao}, origem{funcao: local|diaria|aloj},
                cidade_origem_id, reajuste: { mes_idx, pct } | null (null = automático pela CCT),
                situacao: rascunho|em_analise|aprovada, criado_em }
```

---

## 2. Calendário

- Feriados nacionais fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12, e 20/11 a partir de 2024.
- Feriados móveis pela Páscoa (algoritmo de Meeus/Butcher):
  - Sexta-feira Santa (P−2): sempre;
  - Carnaval (P−48, P−47): opcional, **padrão desligado**;
  - Corpus Christi (P+60): opcional, **padrão ligado**.

  Os padrões seguem a planilha MM Ubá v10.
- Feriados da empresa (Parâmetros) e municipais (cidade da obra e obra) somam-se aos nacionais.
- Para cada mês:
  - `seg` = segunda a sexta úteis;
  - `sab` = sábados úteis;
  - `rep` = domingos + feriados em dia útil;
  - `úteis = seg + sab`;
  - **DSR% = rep ÷ úteis**.
- **Dias trabalhados** = `seg` (+ `sab` se "sábado trabalhado").
- Modo `fixo`: dias = `dias_fixos` e DSR = `dsr_fixo_pct`.
- Validado: fev/2017 = 24 úteis e 4 repousos; abr/2017 = 23 e 7; mai/2017 = 26 e 5. Bate com a planilha antiga.

---

## 3. Parâmetros aplicados por mês

- **Obra, época:** `p(i)` = tabela da data-base em vigor no mês `i`. Começa em `obra.data_base` e muda nos meses de `trocas_tabela`.
- **Obra, atualizado:** `p(i)` = tabela vigente.
- **Projeção com cidade:** `p0` = cópia da tabela vigente, à qual se aplica:
  - `salarios`, `beneficios` e `gratificacoes` da CCT da cidade;
  - `vt_diaria = tarifa_local × conducoes × 2`;
  - ISS (alíquota S/P) = `iss_pct` da cidade.
- **Reajuste:** se `projecao.reajuste` for nulo, vale **todo mês `i ≥ 1` cujo mês do calendário = `cct.mes_data_base`** (um por data-base dentro do prazo), com `pct = cct.reajuste_estimado_pct`. A partir de cada `i`, salários, benefícios e gratificações são multiplicados por `(1 + pct)`, **compostos** e arredondados ao centavo em cada passo (24 meses de mar/27: 1.400 → 1.484 em mai/27 → 1.573,04 em mai/28). Reajuste **informado** vence o automático; informado com **0%** significa sem reajuste. *(Decisão M3: o protótipo aplicava só o primeiro.)*
- **Projeção sem cidade:** tabela vigente.

---

## 4. Custo de uma função num mês (`custo(o, f, i, p)`)

Notação:
- `x` = pessoa-mês equivalente da função no mês;
- `s` = salário;
- `a` = absenteísmo (fração, limitada a 0,9);
- `tot_i` = soma de `x` de todas as funções.

Regime:
- `est` = função com vínculo estágio;
- `reg` = `e` (estágio), `s` (S/P) ou `f` (CLT).

### 4.1 Ausências e salário
```
licD = licenca_pessoa_dias(i) × x / tot_i
ferD = ferias_pessoa_dias(i) × x / tot_i            (0 para estágio)
xa   = max(0, x − (licD + ferD) / 30)               pessoa-mês pago como salário
pres = xa × (1 − a)                                 pessoa-mês presente

bruto   = xa × s
faltasH = bruto × a
faltasD = faltasH × DSR%(i)                          (0 para estágio) — perda do repouso
salv    = máx(0, bruto − faltasH − faltasD)              (limite em zero: decisão M3, como o protótipo)
bolsa   = salv se estágio, senão 0
```

### 4.2 Adicionais (zero para estágio)
```
grat   = salv × grat_premios_pct
peric  = salv × peric_pct(f)
insal  = pres × salario_minimo × insal_pct_sm(f)
transf = salv × transf_pct              se f ∈ funcoes_transferidas
gratF  = xa × gratificacao_CCT(f)       (R$ fixo por pessoa·mês)
not    = pres × horas_noturnas(f) × s / divisor × adicional_noturno_pct
dsrNot = not × DSR%(i)
extras = grat + peric + insal + transf + gratF + not + dsrNot
```

### 4.3 Horas extras
```
h   = HE_media(i) × fator_funcao(f)     (0 para estágio)
vb  = s / divisor
HE_t = pres × h × mix_t × vb × (1 + adicional_t)     t ∈ {util, sabado, intervalo, feriado}
HE   = Σ HE_t
DSR  = HE × DSR%(i)
```
Fatores de HE por função (referência do protótipo): mestre 0,4 · encarregado 1,3 · pedreiro 1,1 · carpinteiro 1,2 · armador 1,2 · servente 0,9 · eletricista 1,1 · operador 1,0 · técnico de segurança 0,5 · almoxarife 0,6 · auxiliar de engenharia 0,5 · vigia 0,8 · administrativo 0,3.

### 4.4 Encargos, benefícios e demais
```
remun = salv + extras + HE + DSR
enc   = remun × soc%(reg)        soc% inclui a incidência sobre férias+1/3+13º (soc × (fer+1/3+13º))
prov  = remun × prov%(reg)       se provisionar; prov% = férias 1/12 + 1/3 + 13º 1/12 + GRRF (8% × 40%)
nf    = remun × nf%(reg)         só S/P (ISS, PIS, COFINS, CPRB)
                                 estágio: enc = prov = nf = 0

vtDia = origem(f) = aloj   → 0                       (com ou sem cidade)
        origem(f) = diaria → passagem_de[origem] × 2  (se não cadastrada: (tarifa obra + tarifa origem) × 2)
        senão              → vt_diaria (p)
VTbruto = pres × vtDia × dias_trabalhados(i)          (CLT e estágio; 0 para S/P)
VTdesc  = min(VTbruto, 6% × bruto)                    (0 para estágio)
VT      = VTbruto − VTdesc

benef = Σ x × beneficio_b    CLT: todos; alojamento e viagens só se origem(f)=aloj (projeção)
                              ou obra fora da sede (histórico); estágio: só seguro
exames = adm × admissoes + dem × desligamentos + x × per_anual / 12      (só CLT)
resc   = desligamentos × s × fator_rescisao                               (só CLT)
ferr   = pres × ferramentas_mes(f)                                         (não para estágio)
salFam = xa × 0,6 × cota   se CLT e s ≤ teto   (informativo: compensado na GPS, custo zero)
ferPag = ferD / 30 × s × 4/3                                               (só CLT)

sub   = salv + extras + HE + DSR + enc + prov + VT + benef + exames + resc + nf + ferr
rl    = sub × (risco + lucro + trib_lucro)
total = sub + rl
caixa = total − prov + ferPag × (1 + soc%)   (antes do deslocamento de adiantamento)
dias  = pres × dias_trabalhados(i)
```

### 4.5 Caixa com adiantamento
Com `adiantamento` ligado e `ap = adiantamento_pct`, o caixa é deslocado função a função:
- o mês `i` perde `remun_i × (1 − ap)`, exceto o último mês;
- o mês `i` recebe `remun_{i−1} × (1 − ap)` do mês anterior.

O total do período não muda.

### 4.6 Admissões e desligamentos
```
e     = cab_i × rotatividade        (só para i > 0 e cab_i > 0)
churn = ⌊e⌋ + (aleatório determinístico(obra,f,i) < frac(e) ? 1 : 0)
adm_i = max(0, cab_i − cab_{i−1}) + churn
dem_i = max(0, cab_{i−1} − cab_i) + churn  (+ 50% de cab no último mês: desmobilização)
```
No histórico real, admissões e desligamentos vêm da folha. A fórmula acima vale só para projeções e para dados sintéticos.

### 4.7 Indicadores derivados
Divisão por zero dá 0. No motor: `indicadores(resultado)`.
- **R$ por dia, com taxa** = total ÷ dias. **Sem taxa** = remun ÷ dias.
- **Encargos %** = (enc + prov + nf) ÷ remun.
- **Benefícios %** = (VT + benef) ÷ remun.
- **Custo de 1 hora extra cheia** = vh × (1 + DSR%) × (1 + soc% + prov% + nf%).
- **% indireta** = PM (indireta + adm) ÷ PM total.

---

> **Implementação (M3):** `packages/motor` — `modelo.ts` (entrada), `parametros.ts` (§3), `calendarioObra.ts` (§2), `custo.ts` (§4.1–§4.4), `obra.ts` (§4.5 e agregações), `movimentos.ts` (§4.6), `projecao.ts` (§5 e §5.1), `rubricas.ts` (§6.1 e §7). Cada componente do custo sai separado (`CustoMes`), rastreável até a fórmula.

## 5. Projeção de quantidades

Para cada função `f` com referências `R` e estatística `agg` (média ou mediana):
- **Escala com área:**
  - `PMk = agg(PM_f(r) ÷ área(r) × 1.000) × (1 + ajuste_f)`;
  - a distribuição no tempo é a média das curvas **das referências que tiveram a função** (PM > 0), normalizadas por sobreposição de frações do prazo (`shares`, soma 1). Referência sem a função entra com 0 no PMk, mas não achata a curva. *(Decisão M3: o protótipo fazia a média de todas as referências.)*
  - `q_f(j) = round(PMk × área/1.000 × share(j))`.
- **Fixo por mês:** `q_f(j) = round(agg(média mensal de cabeças) × (1 + ajuste_f))`. Sem cabeças na referência, vale o teto do equivalente de cada mês.
- **Quantidades manuais:** substituem tudo.
- **Premissas:** cada uma usa o valor informado ou, na falta dele, `agg` das referências:
  - HE, absenteísmo e rotatividade;
  - mix de HE (média das referências);
  - licenças e férias: `round(agg(Σ dias ÷ PM) × PM do mês)` — pessoa-dias inteiros por mês, como no protótipo. *(Registrado na revisão do M3.)*
- **Validações:** prazo ≤ 0 não projeta; referência com área ≤ 0 fica fora do PMk e da curva.

## 5.1 Cenários de origem
No resultado, a mesma projeção é recalculada com a origem trocada para todas as funções: **local**, **diária** e **alojada**. A diferença em R$ e % é mostrada contra o plano.

---

## 6. Conferências obrigatórias

1. **Rubricas × custo:**
   - `Σ rubricas com componente ∉ {nao, info, provpaga, compgps}` = `remun + resc + ferr`, por mês, com tolerância de R$ 1;
   - mostra "Confere" ou "Diferença";
   - descontos do empregado (INSS, IRRF, VT 6%, cesta, café, taxa negocial) ficam fora do custo.
2. **Apropriação × ERP:**
   - por mês, `Σ contas` contra o realizado;
   - toda diferença ≥ R$ 1 exige justificativa (lista controlada).
3. **Carga bloqueante:** não grava com função da folha sem mapeamento, rubrica nova sem classificação ou NF sem competência.

### 6.4 Carga de uma obra (M4)
Layout padrão do ITO (`packages/carga/src/layout.ts`): folha com as abas **Rubricas** (competência, matrícula, função, rubrica, descrição, referência, valor), **Pessoas** (dias de vínculo, admitido, desligado, faltas em horas, dias de licença e de férias, obra onde trabalhou) e **Resumo** (total de proventos); ponto (HE e faltas por matrícula); VT (crédito por matrícula); realizado do ERP (mês × conta); NFS-e em XML (padrão nacional ou ABRASF). Colunas fora do layout (nome, CPF) não são lidas.

Quantidades da obra, inversas das fórmulas do §4 (o motor reproduz as horas da folha):
```
x(matrícula)  = Σ dias de vínculo ÷ dias do mês    (vazio = 1; sem a aba Pessoas, 1;
                rubrica sem linha em Pessoas = 0)
cabeças       = matrículas distintas com x > 0 na função e mês
lic, fer      = Σ dias informados (pessoa-dias)
a (abs.)      = Σ faltas_h ÷ ((Σx − (lic + fer) ÷ 30) × divisor)          (limite 0,9)
HE média      = Σ horas das rubricas de HE ÷ Σ_f (xa_f × (1 − a) × fator_f)   (sem estágio)
mix de HE     = horas por tipo (rubricas.tipo_he; sem tipo = úteis) ÷ horas totais da obra
rotatividade  = Σ_{i≥1,f} mín(adm, dem) ÷ Σ_{i≥1,f} cabeças                    (inversa do §4.6)
```
MDO realocada (coluna "Obra onde trabalhou") fica fora do efetivo e das quantidades; vira `realocacoes` (cedida) com o saldo de VT.
Dois textos da folha mapeados para a mesma função, na mesma matrícula e mês (troca de cargo), somam dias, faltas, licença, férias e rubricas. Estágio fica fora da HE média e do mix. O VT da matrícula entra uma vez no mês; S/P não recebe VT. Matrícula precisa ter ao menos um número (texto só de letras pode ser nome). Nota fiscal repetida (CNPJ + número) fica uma.

Verificações (`verificarCarga`); **pendente** bloqueia a gravação:
- proventos lidos × Resumo da folha, diferença ≥ R$ 1 → pendente (a folha veio incompleta);
- erro de leitura do ERP ou das NFs, estorno que deixa HE ou VT negativos no mês, MDO realocada sem obra de destino → pendente; erro de leitura do ponto ou do VT, matrícula com rubricas e sem linha em Pessoas → alerta;
- função sem função padrão, rubrica nova sem classificação, competência fora do período, NF sem competência → pendente;
- apropriação × ERP: caixa do ITO (época) × Σ contas do ERP por mês (o banco soma as linhas do ERP; não usa o total enviado pela tela); diferença ≥ R$ 1 sem justificativa → pendente;
- ponto × folha acima de 1%, VT ausente sem confirmação → alerta;
- conferência rubricas × custo (§6.1) com os **valores reais** da folha (descontos negativos) × `remun + resc + ferr` do motor na tabela da época → alerta quando não confere.

---

## 7. Mapeamento de rubricas de referência (gerador do protótipo)

| Cód. | Rubrica | Valor |
|---|---|---|
| 1 | Horas normais | salv + faltas − bolsa |
| 300 | Bolsa estágio | bolsa |
| 20 / 2126 / 2127 | Gratificações / prêmio / prêmio de produção | 53% / 35% / 12% de grat (+ gratF em 20) |
| 149 / 155 / 160 / 161 / 170 | Periculosidade / insalubridade / noturno / DSR noturno / transferência | componente próprio |
| 200 / 201 / 205 / 210 | HE úteis / sábado / intervalo / feriado | HE por tipo |
| 250 / 251 / 252 | DSR s/ HE ativos / demitidos / ajuste | 92% / 5% / 3% do DSR |
| 40 / 42 | Faltas / DSR de faltas | −faltasH / −faltasD |
| 310 | Depreciação de ferramentas | ferr |
| 400 / 401 | Férias gozadas / 1/3 | 75% / 25% de ferPag (baixa de provisão) |
| 320 | Salário-família | salFam (compensado na GPS) |
| 2003 | VT 6% | −VTdesc |

---

## 8. Testes de referência (golden tests)

- **Tabela da empresa (CCT 2026):** encargos sociais CLT = **43,96%** (inclui incidência de 7,16%); provisões = **22,64%**; total S/P = 6,65%. Bate com a planilha AF v07.
- **Calendário:** fev/2017 → 24 úteis e 4 repousos; abr/2017 → 23 e 7 (feriados 14/04 e 21/04); mai/2017 → 26 e 5.
- **Conferência da folha:** diferença máxima R$ 0,00 em todas as obras de exemplo.
- **Reajuste automático:** projeção em Vespasiano de mar/27 a nov/27 (CCT BH, data-base mai, 6%) → salário do pedreiro 1.400 até abr/27 e 1.484 a partir de mai/27.
- **Origem:** a mesma projeção com MO vinda de BH todo dia tem VT diário de R$ 24,80, contra R$ 11,00 com MO local.
