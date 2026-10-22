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
- [x] **Funções padrão:**
  - grupo, conta, escala com área, vínculo (CLT ou estágio);
  - exames (adm, per, dem), periculosidade, insalubridade, horas noturnas, ferramentas;
  - sinônimos; criar função.
- [x] **Rubricas:** dicionário com tipo, componente e base de provisões; criar rubrica
- [x] **Parâmetros (tabela da empresa):**
  - abas: salários, encargos (itens editáveis por data-base), benefícios, HE/VT/rescisões, adicionais e verbas, datas-base;
  - criar data-base com reajuste; escolher a vigente.
- [x] **Calendário:**
  - feriados nacionais e móveis (Páscoa);
  - Carnaval e Corpus Christi opcionais;
  - feriados da empresa;
  - tabela de dias e DSR por mês.
- [x] Carga inicial: 13 funções (+ Estagiário), rubricas de referência (SPEC §7) e tabelas 2023 a 2026

**Aceite:** os golden tests de encargos (43,96% / 22,64% / 6,65%) e de calendário (SPEC §8) passam; todas as listas têm busca.

> ✅ 21/10/2026: golden de encargos e calendário no motor (`packages/motor`), no banco (pgTAP) e pela interface (e2e `m1-parametros`); Funções e Rubricas com busca, filtros, ordenação e paginação.

---

## M2 — Cidades e CCTs
**Objetivo:** preços por lugar da obra, preparados para dezenas de CCTs e centenas de cidades.
- [x] Modelo `CCT` e `Cidade` (SPEC §1.1)
- [x] Aba **Convenções**, em lista + detalhe:
  - lista com busca (inclusive por cidade coberta), ordenação e paginação de 10;
  - detalhe com nome, cidades vinculadas (vincular), data-base e reajuste, benefícios;
  - **salário e gratificação fixa por função**, com diferença % para a empresa e "comparar com" outra CCT;
  - ajuste em lote (salários e gratificações); duplicar; excluir só sem cidades.
- [x] **Comparar lado a lado:** até 4 CCTs, só leitura, menor salário destacado, funções com gratificação
- [x] Aba **Cidades:** busca, filtro por CCT e paginação de 15. Campos: CCT, tarifa, conduções, passagem vindo de BH (com VT diário calculado e "estimado" quando faltar), ISS e feriados recorrentes.
- [x] Indicadores do topo: nº de CCTs, diferença de salário do pedreiro, data-bases nos próximos 3 meses

**Aceite:** com 100 CCTs e 500 cidades de teste, achar e editar qualquer uma leva menos de 3 interações, sem rolagem lateral em 1.280 px.

> ✅ 21/10/2026: e2e `m2-aceite` cria 100 CCTs e 500 cidades; cidade = buscar + editar na linha (2 interações); CCT = buscar + abrir (2) e editar; sem rolagem lateral (medido por tabela). Golden de VT por origem (R$ 11,00 × R$ 24,80) no motor, no banco e na interface.

---

## M3 — Motor de cálculo
**Objetivo:** biblioteca pura, sem interface, que implementa o SPEC §2 a §6 com cobertura de testes.
- [x] Calendário mensal (DSR%, dias trabalhados), modo calendário e modo fixo
- [x] Parâmetros por mês: trocas de tabela na obra; cidade + CCT + reajuste na projeção
- [x] `custo(o, f, i, p)` completo:
  - ausências e faltas com DSR;
  - adicionais, inclusive gratificação fixa;
  - HE por tipo e DSR;
  - encargos, provisões e NF;
  - VT por origem, com desconto de 6%;
  - benefícios por origem;
  - exames por tipo, rescisão, ferramentas;
  - estágio, salário-família e férias pagas.
- [x] Agregações por obra: meses, funções, grupos, totais. Caixa com adiantamento.
- [x] Admissões e desligamentos para projeções (§4.6)
- [x] Projeção de quantidades (§5) e cenários de origem (§5.1)
- [x] Gerador e conferência de rubricas (§6.1, §7)

**Aceite:** todos os golden tests (SPEC §8) passam; recálculo de uma projeção de 24 meses × 15 funções em menos de 300 ms.

> ✅ 21/10/2026: golden do SPEC §8 reunidos em `packages/motor/src/aceite.test.ts`; projeção 24 × 15 recalcula em ~10 ms. Validação diferencial: custo, obra, projeção, cenários e rubricas iguais ao motor do protótipo, até o centavo, em todas as obras e projeções de exemplo.


---

## M4 — Carga de dados
**Objetivo:** levar uma obra concluída para a base, com conferência.
- [x] Assistente em 5 etapas (PRD §3.6), com rascunho salvo
- [x] **Leitores de arquivo** (layout padrão do ITO; adaptadores das exportações reais quando chegarem as amostras):
  - folha por competência com rubricas, matrícula e função, sem nomes;
  - ponto, VT, XML de NF, realizado do ERP.
- [x] Mapeamento de funções (sinônimos) e classificação de rubricas novas (bloqueante)
- [x] Leitura de HE por tipo, adicionais, licenças, férias, ferramentas, bolsa, salário-família, exames por tipo e marcação de **MDO realocada** (com a obra de destino) — HE por tipo, licenças, férias e realocada viram quantidades; adicionais, ferramentas, bolsa e salário-família ficam guardados por rubrica (para a aba Folha, M5); exames por tipo saem das admissões e desligamentos
- [x] Troca de tabela no meio da obra
- [x] **Verificações:**
  - proventos × resumo;
  - ponto × folha;
  - VT ausente;
  - NF sem competência;
  - apropriação × ERP com justificativa.
- [x] Gravação com efetivo equivalente e cabeças por função e mês

**Aceite:** carga de uma obra real (Mart Minas Paracatu) com conferência de rubricas "Confere" em todos os meses e apropriação × ERP justificada.

> ⏳ 21/10/2026: itens implementados e testados com folha sintética (pacote `@ito/carga`, tela `/carga`, função `gravar_carga`). **Aceite pendente:** carga real da Mart Minas Paracatu depende das exportações anonimizadas da folha e do ERP.
>
> Decisões (21/10/2026): leitores no layout padrão do ITO; adaptadores das exportações reais e o aceite com a Paracatu dependem das amostras anonimizadas. Carga por DP/RH, controladoria e admin; originais não guardados; rascunho no banco por usuário (CLAUDE.md, M4).

---

## M5 — Base histórica e detalhe da obra
**Objetivo:** consulta completa do histórico.
- [x] **Base histórica:**
  - grupos, busca, indicadores;
  - tabela compacta (PRD §3.1), ordenação, seleção para comparar ou projetar.
- [x] **Obra, 10 abas** (PRD §3.2):
  - visão, efetivo (com o painel de matrículas), custos (por função e por componente), horas extras (leitura + por tipo);
  - folha + conferência, pessoas, apropriação, indicadores, MDO realocada, premissas.
- [x] Alternâncias época/atualizado, competência/caixa, grupos de função, eixo por data ou relativo, barras empilhadas ou agrupadas
- [x] Edição de premissas e ausências com recálculo imediato

**Aceite:** os números de todas as abas batem com o motor (testes de snapshot); a tabela da base fica sem rolagem lateral em 1.280 px; 1.000 obras de teste carregam em menos de 2 s, com paginação ou virtualização.

> ✅ 21/10/2026: snapshot dos números do motor nas abas (`obraDoBanco.test.ts`) e ida e volta carga → banco → motor no centavo; base sem rolagem lateral em 1.280 px; mais de 1.000 obras carregam em ~1,1 s (e2e `m5-base`).
>
> Decisões (21/10/2026): edição por quem carrega; abas por matrícula só para quem carrega; resumo da obra em cache no banco; edição grava ao sair do campo (CLAUDE.md, M5).

---

## M6 — Comparar obras
- [x] 2 a 4 obras: histogramas alinhados por mês relativo, indicadores lado a lado e custos a valores vigentes

**Aceite:** a comparação abre a partir da seleção na base e do botão "Comparar com…" na obra.

> ✅ 21/10/2026: abre pela seleção na base e por "Comparar com…" na obra (e2e `m6-comparar`).
>
> Decisões (21/10/2026): seleção compartilhada na sessão; eixo em mês relativo com opção % do prazo; escolha com busca (CLAUDE.md, M6).

---

## M7 — Projeções
**Objetivo:** planejar uma obra nova a partir do histórico, com os preços da cidade.
- [x] Lista com busca, situação e seleção para comparar projeções
- [x] **Assistente em 4 passos** (PRD §3.4):
  - **passo 1:** cidade e resumo de preços;
  - **passo 2:** referências (sugestão das 5 mais parecidas, faixa de área, média ou mediana) ou quantidades manuais;
  - **passo 3:**
    - ajustes por função e HE;
    - premissas, regime e transferência;
    - **origem por função** e cidade de origem;
    - **reajuste automático ou informado**;
    - licenças e férias, HE por tipo.
- [x] **Resultado:**
  - indicadores e premissas aplicadas;
  - histograma, efetivo e custo;
  - **"Quanto custa trazer gente de fora"**;
  - curva S;
  - projeção × referências.
- [x] Ações: situação, duplicar, editar, copiar para Excel; navegação ‹ › e seletor entre projeções
- [x] Comparar 2 ou mais projeções lado a lado

**Aceite:** os golden tests de reajuste automático e de origem (SPEC §8) passam pela interface; uma projeção completa leva menos de 10 minutos.

> Aceite verificado em 21/10/2026: `e2e/m7-projecoes.spec.ts` faz o golden pela tela (Vespasiano com a CCT de BH: pedreiro R$ 1.400,00 → R$ 1.484,00 em mai/27; VT R$ 11,00 local × R$ 24,80 vindo de BH) e uma projeção completa em segundos; testes unitários em `lib/projecaoDoBanco.test.ts`.

> Decisões (21/10/2026): edição por planejamento, engenharia, controladoria e admin (Aprovada só controladoria, diretoria, admin); copiar para Excel pela área de transferência; 5 mais parecidas por tipologia, área e prazo; grava entradas + resumo (CLAUDE.md, M7).

---

## M8 — Exportações e relatórios
- [x] Exportar para .xlsx (efetivo, custo por função e por componente, rubricas, apropriação, projeção) com **formato contábil brasileiro**
- [x] Copiar tabela para Excel (área de transferência) mantendo o formato BR
- [x] PDF de resumo da projeção para a diretoria

**Aceite:** os arquivos abrem no Excel com ponto no milhar e vírgula no decimal, sem reformatar.

> Aceite verificado em 21/10/2026: `e2e/m8-exportacoes.spec.ts` baixa os .xlsx da obra e da projeção e confere que os valores são números (R$ em centavos) com o código de formato contábil (`"R$" * #,##0.00`), que o Excel em português mostra com ponto no milhar e vírgula no decimal; o texto copiado sai em 1.234,56; o resumo da projeção vira PDF A4.

> Decisões (21/10/2026): .xlsx com números e formato contábil BR gerado no navegador; rubricas agregadas sem matrícula, só para quem carrega; copiar para Excel nas tabelas mês a mês da obra; PDF da projeção por página de impressão (CLAUDE.md, M8).

---

## M9 — Migração do histórico
- [x] Importador das planilhas .xlsm "Histograma de Mão de Obra", nas versões MM Ubá v10 (folha por funcionário) e AF v07 (histograma por função)
- [x] Migração de todas as obras históricas disponíveis, com relatório de pendências por obra
- [x] Vínculo de cada obra histórica à cidade e à CCT

**Aceite:** todas as planilhas disponíveis estão na base; as divergências estão listadas e justificadas.

> Aceite (22/10/2026): as 23 obras do zip "Histogramas das Obras" (31 planilhas; 4 versões antigas deixadas de lado) estão na base local e na homologação — 716 pessoas, 3.172 lançamentos, 2.640,4 pessoa-mês. Divergências listadas em `docs/migracao/relatorio.md`: proventos × planilha (.xlsb), efetivo × histograma da planilha (.xlsm), conferência rubricas × custo do ITO, estimativas (HE e fração do mês no .xlsb) e pendências (áreas provisórias de 10.000 m², funções e rubricas a revisar, data-bases 2016–2022). Ferramenta: `pnpm migrar preparar|carregar` (`packages/migracao`).

> Decisões (21/10/2026): base = zip "Histogramas das Obras" (.xlsm 2017–2020 e .xlsb 2023–2026); Ampla e Clássica numa obra só, com a construtora de cada pessoa guardada; versão mais recente nas duplicatas; script local de migração pelo caminho da carga; destino local → homologação (CLAUDE.md, M9).

---

## M10 — Endurecimento
- [x] Auditoria (quem alterou parâmetros, CCTs, premissas e projeções; versão anterior)
- [x] Performance com 1.000 obras, 100 CCTs e 500 cidades. Medido em 22/10/2026 no Supabase local (`pnpm desempenho gerar`, depois `ITO_DESEMPENHO=1 pnpm e2e e2e/m10-desempenho.spec.ts`): base com 1.000 obras abre em 1,1 s, filtra em 0,1 s e pagina em 0,3 s; detalhe de obra 1,1 s; 100 CCTs 1,3 s; 500 cidades 0,1 s; projeção de 36 meses com 5 referências e 20 funções recalcula em 53 ms (meta 300 ms, teste `desempenho.test.ts`)
- [x] Acessibilidade (navegação por teclado, contraste nos dois modos): axe (WCAG 2.1 A/AA) nas 12 telas e no login, claro e escuro, sem violação séria ou crítica; busca Ctrl+K, foco visível e abas por setas testados (`e2e/m10-acessibilidade.spec.ts`)
- [x] Backup e restauração; documentação de operação (`pnpm db:backup`, `pnpm db:restaurar`, ensaio local em 22/10/2026; [docs/OPERACAO.md](docs/OPERACAO.md))
- [x] **Tela de usuários** (só admin), sem precisar do painel do Supabase nem de SQL:
  - lista com busca, perfil, admin, situação (ativo ou desativado) e último acesso;
  - convidar por e-mail já com perfil e admin (Edge Function com a chave de serviço; ela nunca vai para o front);
  - trocar perfil e admin, desativar e reativar (sem apagar: a autoria do que a pessoa gravou fica);
  - o admin não remove o próprio acesso de admin nem desativa a si mesmo;
  - **tabela de permissões por perfil** na própria tela: para cada módulo (base histórica, folha por matrícula, carga, cidades e CCTs, parâmetros, funções, rubricas, projeções, aprovação, exportações, usuários), o que cada perfil lê, edita ou aprova e as limitações. A tabela sai das mesmas regras do banco (funções `pode_*`), com teste que falha se as duas divergirem.

Ordem dos itens (um commit cada): 1. auditoria (banco + tela + histórico nos detalhes); 2. tela de usuários (Edge Function, permissões); 3. performance (gerador sintético, metas em teste, paginação no servidor onde faltar); 4. acessibilidade (axe nas rotas, teclado, contraste); 5. backup, restauração e `docs/OPERACAO.md`. Decisões no CLAUDE.md (M10).

**Aceite:** carga de teste dentro das metas do PRD §5; nenhuma pendência crítica de acessibilidade; um admin convida, muda o perfil e desativa um usuário pela tela, e a tabela de permissões confere com o banco.

---

## Dependências

```
M0 → M1 → M2 ─┐
        M1 → M3 ┼→ M4 → M5 → M6
              └────────→ M7 → M8
M4 + M5 → M9 → M10
```
