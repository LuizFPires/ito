# ITO — PLAN (implementação por milestones)

> Versão 2.0 · outubro/2026
> Cada milestone tem um objetivo, as entregas e os critérios de aceite. Marque `[x]` ao concluir. Um milestone só é dado como fechado quando todos os critérios de aceite passam.
> Referências: `PRD.md` (o quê), `SPEC.md` (como calcular) e o protótipo **ITO 2.0** (como se comporta e como é a tela).

---

## M0 — Fundação
**Objetivo:** projeto rodando, com autenticação, design system e esqueleto de navegação.
- [x] Repositório, ambientes (dev/homologação/produção), CI com lint e testes — homologação e produção com migrações e Auth aplicados; Vercel ligada ao GitHub (`docs/AMBIENTES.md`)
- [x] Banco de dados e migrações
- [x] Autenticação e perfis (planejamento, engenharia, DP/RH, controladoria, diretoria). Permissões finais a confirmar com a diretoria.
- [x] Design system "Canteiro" em tokens:
  - grafite e âmbar; Geist e Geist Mono;
  - pills; modo claro e escuro.
- [x] Shell: menu lateral (Análise / Dados / Configuração), busca global ⌘K, aviso de toast
- [x] Utilitários de formatação BR (R$ 1.234,56; dd/mm/aaaa; jan/27) com testes

**Aceite:** login funcionando; as 10 rotas do menu abrem vazias; tokens nos dois modos; testes de formatação passando.

---

## M1 — Cadastros base
**Objetivo:** tudo o que a carga e o motor precisam para classificar e calcular.
- [ ] **Funções padrão:**
  - grupo, conta, escala com área, vínculo (CLT ou estágio);
  - exames (adm, per, dem), periculosidade, insalubridade, horas noturnas, ferramentas;
  - sinônimos; criar função.
- [ ] **Rubricas:** dicionário com tipo, componente e base de provisões; criar rubrica
- [ ] **Parâmetros (tabela da empresa):**
  - abas: salários, encargos (itens editáveis por data-base), benefícios, HE/VT/rescisões, adicionais e verbas, datas-base;
  - criar data-base com reajuste; escolher a vigente.
- [ ] **Calendário:**
  - feriados nacionais e móveis (Páscoa);
  - Carnaval e Corpus Christi opcionais;
  - feriados da empresa;
  - tabela de dias e DSR por mês.
- [ ] Carga inicial: 13 funções, rubricas de referência (SPEC §7) e tabelas 2023 a 2026

**Aceite:** os golden tests de encargos (43,96% / 22,64% / 6,65%) e de calendário (SPEC §8) passam; todas as listas têm busca.

---

## M2 — Cidades e CCTs
**Objetivo:** preços por lugar da obra, preparados para dezenas de CCTs e centenas de cidades.
- [ ] Modelo `CCT` e `Cidade` (SPEC §1.1)
- [ ] Aba **Convenções**, em lista + detalhe:
  - lista com busca (inclusive por cidade coberta), ordenação e paginação de 10;
  - detalhe com nome, cidades vinculadas (vincular), data-base e reajuste, benefícios;
  - **salário e gratificação fixa por função**, com diferença % para a empresa e "comparar com" outra CCT;
  - ajuste em lote (salários e gratificações); duplicar; excluir só sem cidades.
- [ ] **Comparar lado a lado:** até 4 CCTs, só leitura, menor salário destacado, funções com gratificação
- [ ] Aba **Cidades:** busca, filtro por CCT e paginação de 15. Campos: CCT, tarifa, conduções, passagem vindo de BH (com VT diário calculado e "estimado" quando faltar), ISS e feriados recorrentes.
- [ ] Indicadores do topo: nº de CCTs, diferença de salário do pedreiro, data-bases nos próximos 3 meses

**Aceite:** com 100 CCTs e 500 cidades de teste, achar e editar qualquer uma leva menos de 3 interações, sem rolagem lateral em 1.280 px.

---

## M3 — Motor de cálculo
**Objetivo:** biblioteca pura, sem interface, que implementa o SPEC §2 a §6 com cobertura de testes.
- [ ] Calendário mensal (DSR%, dias trabalhados), modo calendário e modo fixo
- [ ] Parâmetros por mês: trocas de tabela na obra; cidade + CCT + reajuste na projeção
- [ ] `custo(o, f, i, p)` completo:
  - ausências e faltas com DSR;
  - adicionais, inclusive gratificação fixa;
  - HE por tipo e DSR;
  - encargos, provisões e NF;
  - VT por origem, com desconto de 6%;
  - benefícios por origem;
  - exames por tipo, rescisão, ferramentas;
  - estágio, salário-família e férias pagas.
- [ ] Agregações por obra: meses, funções, grupos, totais. Caixa com adiantamento.
- [ ] Admissões e desligamentos para projeções (§4.6)
- [ ] Projeção de quantidades (§5) e cenários de origem (§5.1)
- [ ] Gerador e conferência de rubricas (§6.1, §7)

**Aceite:** todos os golden tests (SPEC §8) passam; recálculo de uma projeção de 24 meses × 15 funções em menos de 300 ms.

---

## M4 — Carga de dados
**Objetivo:** levar uma obra concluída para a base, com conferência.
- [ ] Assistente em 5 etapas (PRD §3.6), com rascunho salvo
- [ ] **Leitores de arquivo:**
  - folha por competência com rubricas, matrícula e função, sem nomes;
  - ponto, VT, XML de NF, realizado do ERP.
- [ ] Mapeamento de funções (sinônimos) e classificação de rubricas novas (bloqueante)
- [ ] Leitura de HE por tipo, adicionais, licenças, férias, ferramentas, bolsa, salário-família, exames por tipo e marcação de **MDO realocada** (com a obra de destino)
- [ ] Troca de tabela no meio da obra
- [ ] **Verificações:**
  - proventos × resumo;
  - ponto × folha;
  - VT ausente;
  - NF sem competência;
  - apropriação × ERP com justificativa.
- [ ] Gravação com efetivo equivalente e cabeças por função e mês

**Aceite:** carga de uma obra real (Mart Minas Paracatu) com conferência de rubricas "Confere" em todos os meses e apropriação × ERP justificada.

---

## M5 — Base histórica e detalhe da obra
**Objetivo:** consulta completa do histórico.
- [ ] **Base histórica:**
  - grupos, busca, indicadores;
  - tabela compacta (PRD §3.1), ordenação, seleção para comparar ou projetar.
- [ ] **Obra, 10 abas** (PRD §3.2):
  - visão, efetivo (com o painel de matrículas), custos (por função e por componente), horas extras (leitura + por tipo);
  - folha + conferência, pessoas, apropriação, indicadores, MDO realocada, premissas.
- [ ] Alternâncias época/atualizado, competência/caixa, grupos de função, eixo por data ou relativo, barras empilhadas ou agrupadas
- [ ] Edição de premissas e ausências com recálculo imediato

**Aceite:** os números de todas as abas batem com o motor (testes de snapshot); a tabela da base fica sem rolagem lateral em 1.280 px; 1.000 obras de teste carregam em menos de 2 s, com paginação ou virtualização.

---

## M6 — Comparar obras
- [ ] 2 a 4 obras: histogramas alinhados por mês relativo, indicadores lado a lado e custos a valores vigentes

**Aceite:** a comparação abre a partir da seleção na base e do botão "Comparar com…" na obra.

---

## M7 — Projeções
**Objetivo:** planejar uma obra nova a partir do histórico, com os preços da cidade.
- [ ] Lista com busca, situação e seleção para comparar projeções
- [ ] **Assistente em 4 passos** (PRD §3.4):
  - **passo 1:** cidade e resumo de preços;
  - **passo 2:** referências (sugestão das 5 mais parecidas, faixa de área, média ou mediana) ou quantidades manuais;
  - **passo 3:**
    - ajustes por função e HE;
    - premissas, regime e transferência;
    - **origem por função** e cidade de origem;
    - **reajuste automático ou informado**;
    - licenças e férias, HE por tipo.
- [ ] **Resultado:**
  - indicadores e premissas aplicadas;
  - histograma, efetivo e custo;
  - **"Quanto custa trazer gente de fora"**;
  - curva S;
  - projeção × referências.
- [ ] Ações: situação, duplicar, editar, copiar para Excel; navegação ‹ › e seletor entre projeções
- [ ] Comparar 2 ou mais projeções lado a lado

**Aceite:** os golden tests de reajuste automático e de origem (SPEC §8) passam pela interface; uma projeção completa leva menos de 10 minutos.

---

## M8 — Exportações e relatórios
- [ ] Exportar para .xlsx (efetivo, custo por função e por componente, rubricas, apropriação, projeção) com **formato contábil brasileiro**
- [ ] Copiar tabela para Excel (área de transferência) mantendo o formato BR
- [ ] PDF de resumo da projeção para a diretoria

**Aceite:** os arquivos abrem no Excel com ponto no milhar e vírgula no decimal, sem reformatar.

---

## M9 — Migração do histórico
- [ ] Importador das planilhas .xlsm "Histograma de Mão de Obra", nas versões MM Ubá v10 (folha por funcionário) e AF v07 (histograma por função)
- [ ] Migração de todas as obras históricas disponíveis, com relatório de pendências por obra
- [ ] Vínculo de cada obra histórica à cidade e à CCT

**Aceite:** todas as planilhas disponíveis estão na base; as divergências estão listadas e justificadas.

---

## M10 — Endurecimento
- [ ] Auditoria (quem alterou parâmetros, CCTs, premissas e projeções; versão anterior)
- [ ] Performance com 1.000 obras, 100 CCTs e 500 cidades
- [ ] Acessibilidade (navegação por teclado, contraste nos dois modos)
- [ ] Backup e restauração; documentação de operação

**Aceite:** carga de teste dentro das metas do PRD §5; nenhuma pendência crítica de acessibilidade.

---

## Dependências

```
M0 → M1 → M2 ─┐
        M1 → M3 ┼→ M4 → M5 → M6
              └────────→ M7 → M8
M4 + M5 → M9 → M10
```
