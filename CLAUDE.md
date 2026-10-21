# CLAUDE.md — ITO

Guia para trabalhar no código do ITO. Leia antes de qualquer tarefa.

## O que é

O ITO é uma plataforma de **histórico de mão de obra** das obras da Clássica Engenharia. Ela **projeta o histograma e o custo mensal de MO** de obras futuras. Documentos:

- `PRD.md`: o que o produto faz, tela a tela.
- `SPEC.md`: modelo de dados e **todas as fórmulas**. É a fonte de verdade do cálculo.
- `PLAN.md`: implementação por milestones. Marque `[x]` ao concluir cada item e só feche um milestone com os critérios de aceite passando.
- Protótipo **ITO 2.0** (artifact https://claude.ai/artifact/VHYM9uygpEMPPAJVV8a2PS; cópia em `docs/prototipo/ITO_2.0.html`): referência de telas e de comportamento. Os dados dele são ilustrativos.

## Regras invioláveis

1. **Quantidade vem do histórico, preço vem dos parâmetros.** Projeções nunca reaproveitam valores em R$ de obras antigas, só quantidades: pessoa-mês, HE, faltas, rotatividade, licenças, férias e mix de HE. Os preços vêm da cidade da obra (CCT, VT, ISS) e da tabela da empresa.
2. **Nada de nomes de trabalhadores.** O histórico guarda só a matrícula. Não crie campo de nome, CPF ou endereço.
3. **Formato brasileiro sempre:** R$ 1.234,56, 43,96%, dd/mm/aaaa, jan/27. Vale em tela, exportação .xlsx e área de transferência. Use os utilitários de formatação. Nunca `toFixed` em texto exibido.
4. **A conferência da folha fecha no centavo.** `Σ rubricas que entram no custo = remun + resc + ferr` por mês (SPEC §6). Se uma mudança no motor quebrar isso, ela está errada.
5. **O motor é puro.** O cálculo fica numa biblioteca sem interface e sem banco: entrada são dados, saída são números. Todo componente de custo é rastreável até a fórmula.
6. **Golden tests antes de entregar.** Qualquer mudança no motor roda os testes do SPEC §8: encargos 43,96% / 22,64%, calendário 2017, conferência R$ 0,00, reajuste automático, VT por origem.
7. **Configuração escala.** Listas de CCTs, cidades, funções, rubricas, obras e projeções têm busca, ordenação e paginação (ou virtualização). Nunca uma coluna por cadastro.
8. **Sem rolagem lateral nas tabelas principais em 1.280 px.** Agrupe colunas (valor principal + segunda linha em `sub`) antes de adicionar colunas.

## Vocabulário (use estes termos na interface e no código)

| Termo | Uso |
|---|---|
| pessoa-mês / equivalente | efetivo pela fração de dias no mês |
| cabeças | pessoas diferentes no mês |
| época / atualizado | tabela da época × tabela vigente |
| competência / caixa | com provisões × fluxo de pagamento |
| tabela da empresa | Parâmetros por data-base |
| CCT | convenção coletiva (salários, gratificações, benefícios, data-base) |
| cidade | VT, ISS, feriados e qual CCT vale |
| origem da MO | `local`, `diaria` (vem de outra cidade todo dia), `aloj` (alojada) |
| MDO realocada | cedida ou recebida entre obras |
| S/P | prestador com NF, sem encargos de folha |
| grupo de função | `direta`, `indireta`, `adm` |

Não use "praça" para cidade ou CCT; o usuário pediu esses dois nomes.

## Stack (confirmada em 21/10/2026)

- Monorepo **pnpm**: `apps/web`, `packages/formato`, `packages/motor`.
- Front: TypeScript + React (Vite), com o design system "Canteiro" em tokens CSS.
- Back: **Supabase** (PostgreSQL + Auth + RLS). Migrações SQL versionadas em `supabase/migrations`, testes de banco com pgTAP em `supabase/tests`. Lógica de servidor que não couber em SQL/RLS vai para Edge Functions (TypeScript).
- Motor de cálculo: pacote TypeScript compartilhado (`packages/motor`), sem dependências de interface, testado com Vitest.
- Formatação BR: `packages/formato`, usada pela interface e pelas exportações.
- Leitura de planilhas e arquivos: biblioteca .xlsx no servidor, com testes sobre arquivos de exemplo anonimizados.
- Ambientes: **dev** = Supabase local (Docker); **homologação** = Supabase `ito-homologacao` + Vercel Preview; **produção** = Supabase `ito-producao` + Vercel Production. Repositório: `github.com/LuizFPires/ito` (privado).

## Comandos

- `pnpm install` · `pnpm dev` (web em http://localhost:5173)
- `pnpm format:check` · `pnpm lint` (ESLint + tipos) · `pnpm test` (Vitest, todos os pacotes)
- `pnpm db:start` (Supabase local) · `pnpm db:test` (pgTAP) · `pnpm db:reset` (recria e aplica migrações + seed)
- `pnpm build` · `pnpm e2e` (Playwright, precisa do Supabase local)
- Verificação completa antes de PR: `pnpm format:check && pnpm lint && pnpm test && pnpm db:test && pnpm build && pnpm e2e`

## Decisões tomadas

### M0 — Fundação (21/10/2026)
- Repositório próprio e privado do ITO; a pasta `@obsoletos/` (marca antiga e o protótipo "Repositório inteligente de projetos", de outro produto) fica fora do git.
- Stack: monorepo pnpm, React + Vite, Supabase; ambientes de homologação e produção criados já no M0.
- Autenticação por **e-mail e senha** (Supabase Auth), **sem cadastro aberto**: usuários entram por convite. (auto — recomendado)
- Cada usuário tem **um perfil**: `planejamento`, `engenharia`, `dp_rh`, `controladoria`, `diretoria`. Um campo `admin` (independente do perfil) permite gerir usuários. Permissões provisórias até a diretoria confirmar: todos os perfis leem tudo; a escrita por módulo é definida no milestone de cada módulo. (auto — recomendado)
- As **10 rotas** do aceite do M0 = 8 itens do menu (Base histórica, Comparar obras, Projeções, Carga de dados, Cidades e CCTs, Parâmetros, Funções padrão, Rubricas da folha) + detalhe da obra + detalhe da projeção. (auto — recomendado)
- Identidade visual = a do protótipo ITO 2.0 (marca "I" em âmbar + "ITO" em Geist Mono espaçada). Fontes Geist e Geist Mono embarcadas via pacote npm, sem depender do Google Fonts. (auto — recomendado)
- Tema: claro, escuro ou do sistema, escolhido pelo usuário e lembrado no navegador. (auto — recomendado)
- Atalho da busca global: **Ctrl+K** no Windows/Linux e **⌘K** no Mac; a dica na tela mostra a tecla do sistema. (auto — recomendado)
- Roteamento com React Router; dados do servidor com TanStack Query; CSS com tokens + CSS Modules, sem framework de CSS. (auto — recomendado)
- Região dos projetos Supabase: `sa-east-1` (São Paulo). (auto — recomendado)

## Design system "Canteiro" (ITO)

- Cores:
  - âmbar `#F2B705` = **ação** (botão primário, destaque);
  - grafite `#1F2226` = **estado ativo** (chip ou aba selecionada, toggles ligados);
  - texto âmbar sobre claro: `#8A6400`.
- Tipografia: **Geist** no texto e **Geist Mono** nos rótulos, em caixa alta espaçada.
- Formas: pills (`999px`) para botões, chips e segmentos; cartões com raio de 20 px.
- Modo claro e escuro, com tokens definidos nos dois. Gráficos de série usam a paleta de funções:
  - direta em tons âmbar/terra;
  - indireta em grafites;
  - adm em verde-azulado.

## Convenções de código

- Valores monetários em **centavos inteiros** ou decimal de precisão fixa no banco. No motor, `number`, com arredondamento só na exibição e na exportação.
- Índice de mês sempre relativo ao início da obra (`mes_idx` 0..n−1). Conversão para mês/ano só na borda.
- Percentuais guardados como número de 0 a 100 (como na interface) e convertidos no motor.
- Nada de dados reais de trabalhadores em fixtures. Use matrícula sintética.
- Textos da interface em português do Brasil, tom direto. Erros dizem o que fazer ("Informe dia/mês (dd/mm) e a descrição").

## Como trabalhar

1. Leia o milestone atual no `PLAN.md` e os trechos do `PRD.md` e do `SPEC.md` citados.
2. Implemente com testes. Para o motor, primeiro o teste com o número esperado.
3. Rode os golden tests e a conferência da folha.
4. Marque os itens concluídos no `PLAN.md`.
5. Se uma regra do SPEC parecer errada, **pergunte antes de mudar**. O SPEC foi validado contra as planilhas da empresa.
