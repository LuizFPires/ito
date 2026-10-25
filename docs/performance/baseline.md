# Desempenho do ITO — baseline e correções (M12)

Medido em 24/10/2026, seguindo o plano `ITO_Plano_Implementacao_Performance.md` (Fase 0 e
correções P0). Para medir de novo: `pnpm desempenho gerar` (1.000 obras sintéticas no Supabase
local) e `pnpm perf`. Os números brutos ficam em `tela.json`, `motor.json` e `bundle.json`.

## Como foi medido

- **Máquina:** notebook Windows 11 do desenvolvimento, Chromium do Playwright, 1.440 × 900.
- **App:** build de produção (`vite preview`), não o servidor de desenvolvimento.
- **Dados:** Supabase local com as 1.000 obras sintéticas do M10 (só matrícula), 24 meses de
  projeção. A rede é local: na produção (Supabase em São Paulo) as buscas somam a latência da
  internet, então os tempos de **carregar dados** serão maiores; os de **cálculo e tela** valem
  como estão.
- **Latência de uma mexida:** do evento (régua ou número digitado) até o segundo quadro pintado.
- **Tarefa longa:** trecho do navegador ocupado por mais de 50 ms (trava a tela).
- **Sem mudança de cálculo:** golden, diferencial com o protótipo e conferência da folha seguem
  iguais (402 testes unitários).

## Resultado

| Caso | Antes | Depois | Meta do plano |
|---|---:|---:|---:|
| Base histórica: abrir com 1.000 obras (mediana) | 209 ms | 124–870 ms¹ | — |
| Base histórica: LCP | 60–360 ms | 352 ms | ≤ 2,5 s |
| Obra: abrir pela base (app aberto) | — | 156 ms | ≤ 500 ms |
| Obra: abrir pelo endereço (carrega o app) | 889 ms | 947 ms² | — |
| Obra: trocar de aba | 78 ms | 74 ms | ≤ 100 ms |
| Projeção · 5 referências: régua / digitar (do evento ao quadro) | 31 / 31 ms | 29 / 30 ms | ≤ 100 ms |
| Projeção · 5 referências: abrir o resultado | 129 ms | 98 ms | ≤ 500 ms |
| Projeção · 1.000 referências: abrir o histograma | **3.258 ms** | **1.769 ms** | ≤ 500 ms³ |
| Projeção · 1.000 referências: régua / digitar | 68 / 49 ms | 114 / 88 ms⁴ | ≤ 100 ms |
| Projeção · 1.000 referências: abrir o resultado | **6.446 ms** | **293 ms** | ≤ 500 ms |
| Código baixado na abertura (gzip) | 197 kB | 197 kB | — |
| Código total, todas as telas (gzip) | 405 kB | 405 kB | — |

¹ Varia entre rodadas em duas faixas (≈ 150 ms e ≈ 870 ms). As buscas da lista levam de 10 a
30 ms no banco local; a diferença está na abertura do app pelo endereço (sessão e cadastros),
não nos dados.
² Quase tudo é carregar o app (sessão, cadastros, obra); o motor gasta poucos ms.
³ Com 1.000 obras de referência o tempo é de baixar os dados delas (efetivo por função e mês de
cada uma). Com as 5 mais parecidas, 106 ms.
⁴ Oscila ±30 ms entre rodadas; o motor sozinho leva ~60 ms para 1.000 referências em 36 meses.

### Motor (Node, mediana / p95)

| Caso | 5 refs | 23 refs | 100 refs | 1.000 refs |
|---|---:|---:|---:|---:|
| Projeção 9 meses | 2,4 / 3,9 ms | 2,4 / 3,0 ms | 3,4 / 3,9 ms | 17 / 25 ms |
| Projeção 36 meses | 7,5 / 11 ms | 11 / 25 ms | 18 / 24 ms | 60 / 94 ms |
| Cenários de origem 36 meses | 35 / 63 ms | 74 / 157 ms | 86 / 141 ms | 220 / 260 ms |
| Obra 9 / 36 meses (`calcularObra`) | 4,6 / 6,7 ms · 14 / 28 ms | | | |

O motor não é gargalo: cada mexida na projeção recalcula tudo em poucos ms com as referências
de uso normal.

## Gargalos encontrados (com a hipótese verificada)

| # | Gargalo | Evidência | Impacto | Correção | Estado |
|---|---|---|---|---|---|
| G1 | **Resultado da projeção recalculava o resumo de cada referência** (2 cálculos completos do motor por obra) | perfil de CPU: `calendarioMes`, `somar`, `custoFuncaoMes` somando 7 s; 6,4 s para abrir com 1.000 referências | P0 | usa o resumo em cache da base (M5) quando está em dia; a tabela mostra 50 linhas na tela (todas no .xlsx) | corrigido: 6.446 → 293 ms |
| G2 | **Impressão digital do resumo dependia da ordem das listas** (tela e scripts leem funções, benefícios e feriados em ordens diferentes) | 975 de 1.000 resumos gravados pelo gerador eram vistos como velhos pela tela e recalculados (base e projeção) | P0 | impressão em forma canônica (chaves e listas de cadastro ordenadas) | corrigido (teste novo); muda a impressão uma vez: os resumos são recalculados uma vez ao abrir a base |
| G3 | **Referências da projeção baixadas em lotes de 50, um depois do outro** | 20 rodadas em sequência para 1.000 obras; 3,3 s até o histograma | P0 | até 4 lotes ao mesmo tempo, na mesma ordem | corrigido: 3.258 → 1.769 ms |
| G4 | Detalhe da obra buscava a obra e depois realocações, notas e ERP | duas rodadas em sequência | P1 | uma rodada só | corrigido (ganho pequeno no local; maior com a latência da produção) |
| G5 | Base histórica baixa todas as obras e resumos (≈ 600 kB sem compressão com 1.000 obras) | 10–30 ms no local | P2 | paginação no servidor quando a base passar de alguns milhares de obras | pendente (não compensa hoje: 23 obras reais) |
| G6 | Abertura do app pelo endereço direto ≈ 0,9 s (sessão + cadastros) | perfil: CPU baixa, espera de rede | P2 | carregar só os cadastros da tela aberta | pendente (medir na produção antes) |

## Fora de escopo, por decisão (plano genérico × ITO)

- **Web Worker, atualização otimista, feature flags, virtualização:** sem gargalo que os peça
  (mexidas em 30–110 ms; listas paginadas).
- **Monitoramento em produção (Core Web Vitals reais):** Vercel Speed Insights é dependência nova
  com custo conforme o plano da Vercel; decisão do usuário.

## M14 — o que faltou (25/10/2026)

Mesmo método do M12 (`pnpm perf`, build de produção, 1.000 obras sintéticas), na mesma máquina, que
estava mais carregada nesta medição (Supabase local de quatro projetos no Docker): os números de
antes foram medidos de novo no dia, antes das mudanças.

| Caso | Antes (25/10) | Depois | Meta |
|---|---:|---:|---:|
| Projeção · 1.000 referências: abrir o histograma (Playwright, do clique ao gráfico) | 1.955 ms | 700 ms¹ | — |
| Projeção · 1.000 referências: abrir o histograma (medido no app) | — | **466 ms** | ≤ 500 ms |
| Projeção · 1.000 referências: régua, mediana / p95 | 106 / 177 ms | **33 / 43 ms** | ≤ 100 ms |
| Projeção · 1.000 referências: digitar um mês, mediana / p95 | 73 / 94 ms | 31 / 32 ms | ≤ 100 ms |
| Projeção · 1.000 referências: abrir o resultado | 237 ms | 165 ms | ≤ 500 ms |

¹ A medida do Playwright soma a espera dele (a cada tentativa varre a acessibilidade da página para
achar o gráfico) e oscila de 400 a 1.000 ms com a máquina carregada; a medida do app
(`useTempoDeTela`, do passo aberto ao quadro pintado) é a que o monitoramento grava na produção.

| # | Gargalo | Evidência | Correção |
|---|---|---|---|
| G7 | Referências baixadas em ~180 pedidos (efetivo de 160 mil linhas, 1.000 por pedido) | linha do tempo das requisições | `dados_calculo_obras`: obras, competências e efetivo compactos, 4 chamadas de ~1,1 MB; `= any(array)` trocado por junção (2,4 s → 0,3 s no banco) e `json` + `array_agg` no lugar de `jsonb` |
| G8 | Montagem das linhas ordenava as 160 mil linhas | cronômetro das etapas no Node | ordenação das 8,8 mil listas e dos meses de cada uma (mesma ordem) |
| G9 | Cada mexida reconvertia 1.000 obras e refazia os agregados de cada referência | cálculo da régua: 75 ms → 15 ms | `obraDoBanco` uma vez por obra lida; motor guarda os agregados por referência (imutável), com teste de igualdade |

Etapas do ITO ao abrir o histograma com 1.000 referências (Node, mesmo banco): carregar 180–320 ms,
converter 25 ms, calcular 75 ms. Os números do cálculo não mudaram (golden, diferencial e as 300
obras conferidas iguais à consulta antiga).
