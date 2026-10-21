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
- Tokens do Canteiro = os do protótipo ITO 2.0, exceto `--ok` (#18784e) e `--err` (#b83427) no modo claro, escurecidos para passar contraste AA sobre o próprio fundo; teste em `apps/web/src/estilo/tokens.test.ts`. (auto — recomendado)

### M1 — Cadastros base (21/10/2026)
- Edição: **controladoria** edita tudo (parâmetros, encargos, calendário, funções, rubricas); **DP/RH** edita funções e rubricas; **admin** edita tudo; os demais perfis só leem. Regra no banco (RLS), não só na tela.
- Carga inicial com os **valores do protótipo ITO 2.0**: encargos reais (AF v07); salários e benefícios ilustrativos, marcados "a revisar pela controladoria". Os golden tests dependem deles.
- Função ou rubrica fora de uso é **inativada** (some das listas e da carga, fica no histórico). Apagar só o que nunca foi usado.
- Nova data-base = **cópia da vigente + reajuste %** em salários e benefícios (encargos e regras iguais). Só vira vigente quando alguém escolher.
- Carga de **14 funções**: as 13 do SPEC §4.3 + Estagiário (vínculo estágio). (auto — recomendado)
- Calendário e encargos são calculados no motor (`packages/motor`) já no M1; banco e telas só guardam e mostram. (auto — recomendado)
- Revisão do M1 — aceito sem correção, com motivo:
  - DP/RH edita valores das funções que mudam o custo (exames, adicionais, ferramentas, fator de HE). É o que a decisão de edição do M1 permite; **confirmar com a diretoria**.
  - Funções e rubricas sem uso podem ser apagadas pela API. Quando o histórico (M3/M4) referenciar funções e rubricas, essas FKs serão `on delete restrict`.
  - A incidência dos encargos usa os itens de id `ferias`, `terco` e `dec`. A interface não cria nem renomeia itens de encargo; se um dia criar, a regra de incidência vira um campo do item.
  - O motor recebe feriados municipais com data completa; a cidade guarda dd-mm recorrente (SPEC §1.1). A conversão entra no M2.
  - A lista de datas-base não tem busca: é uma linha por ano e fica curta.
- Comparação com o protótipo (21/10/2026):
  - **Data-base editável = a vigente e as "a revisar".** Revisada e fora de vigência fica travada no banco (gatilho `travar_data_base_revisada`) para não mudar o custo "época". Para mudar valores, crie outra data-base ou torne aquela a vigente.
  - **Nova data-base copia sempre da vigente** (sem "Copiar de"); reajuste arredondado **em centavos** (o protótipo arredondava salário a R$ 10 e benefício a R$ 1; mantido centavos por decisão).
  - **Função nova nasce como no protótipo:** salário do oficial (pedreiro) nas data-bases editáveis, conta 04.03.99, exames 150/105/150, escala ligada se direta, cor própria. As data-bases travadas não recebem salário (a função não existia nelas).
  - Tornar vigente uma data-base "a revisar" pede confirmação.
  - Convenções de tela aceitas: KPI "Rubricas ativas" (conta só ativas, por causa da inativação); aviso genérico "Salvo" em toda gravação; rótulos curtos de "Entra no custo como" com a explicação embaixo do nome; "Quem recebe o quê" com os adicionais legais numa coluna (regra 8).
  - Ficam para quando houver histórico: coluna "Obras" em Funções (M4) e os KPIs "Base histórica a valores vigentes" e "Custo de 1 oficial·mês" em Parâmetros (M3/M4).
- O M1 começou empilhado na branch do M0 (`feat/m1-cadastros` a partir de `feat/m0-fundacao`) porque o CI do GitHub está bloqueado por cobrança; o PR do M1 aponta para a `main` depois do merge do M0.

### M2 — Cidades e CCTs (21/10/2026)
- Edição de cidades e CCTs: **controladoria e admin**; os demais perfis só leem (regra no banco).
- Passagem para MO que vem todo dia de outra cidade: **qualquer cidade de origem** (SPEC `passagem_de`). A lista de cidades destaca a passagem vinda de BH; o detalhe cadastra outras origens. Sem passagem, VT **estimado** = (tarifa da obra + tarifa da origem) × 2.
- Nova CCT nasce com os **salários e benefícios da data-base vigente**, sem gratificações, data-base em maio e reajuste 0%. Para partir de outra CCT, use Duplicar.
- Função ou benefício sem valor na CCT usa o **valor da tabela da empresa** (vigente); a tela mostra "da empresa".
- Mês da data-base da CCT guardado de **1 a 12** (no protótipo era 0–11). (auto — recomendado)
- Cidade guarda nome e UF separados (exibição "Nome/UF"). Feriado municipal recorrente = dia + mês; o motor converte para a data de cada ano. (auto — recomendado)
- CCT só é excluída sem cidades vinculadas (PLAN).
- Revisão e comparação com o protótipo (21/10/2026):
  - **Ajuste em lote** vale para tudo o que o editor mostra: funções ativas que usavam o salário da empresa ganham salário próprio já ajustado; pede confirmação e avisa CCT e percentual. (auto — recomendado)
  - Reajuste estimado da CCT aceita de **−50% a 100%** (o protótipo começava em 0). (auto — recomendado)
  - **Nome da CCT é único** (duplicar duas vezes pede renomear a cópia anterior). (auto — recomendado)
  - Aviso genérico "Salvo" também no M2, como no M1. (auto — recomendado)
  - Comparar: célula sem salário na CCT nem na empresa mostra "—" e não entra em maior/menor. (auto — recomendado)
  - Feriados municipais e passagens de outras origens ficam no detalhe da cidade (regra 8); a linha mostra a contagem.
  - Tela abre na CCT de BH; cidade nova nasce na CCT de BH (como o protótipo).

### M3 — Motor de cálculo (21/10/2026)
- **Validação diferencial:** além dos golden do SPEC §8, um teste roda o motor do próprio protótipo (`docs/prototipo/ITO_2.0.html`) sobre as obras de exemplo dele e exige o mesmo resultado do `packages/motor`, componente a componente e mês a mês, até o centavo. As obras de exemplo viram fixtures sintéticas (só matrícula).
- **Salário com faltas limitado a zero:** `salv = máx(0, bruto − faltasH − faltasD)`, como no protótipo (esclarecimento no SPEC §4.1).
- **Movimentação sintética** (admissões e desligamentos por rotatividade, só em projeções e dados sintéticos): mesmo sorteio determinístico do protótipo (hash FNV de obra + função + mês), SPEC §4.6.
- Revisão do M3 (21/10/2026), onde o motor passa a divergir do protótipo de propósito (casos que as obras de exemplo não exercitam):
  - **Curva no tempo só das referências que têm a função** (PMk continua com o zero de quem não tem). SPEC §5.
  - **Todos os reajustes por data-base dentro do prazo, compostos**; informado com 0% = sem reajuste. SPEC §3.
  - **Licenças e férias projetadas arredondadas** a pessoa-dias inteiros por mês, como no protótipo. SPEC §5.
  - Alojada sem VT mesmo sem cidade; quantidade fixa sem cabeças usa o teto do equivalente.
  - Entrada inválida é erro (`ErroEntradaMotor`, com a ação a tomar): função com efetivo fora do cadastro, NaN, negativos, percentual fora de 0–100, mix de HE ≠ 100%. `calcularObra` exige `movimentos` (da folha ou "sinteticos") e `Obra.meses` define a duração.
  - Indicadores do §4.7 em `indicadores(resultado)`; o custo traz a origem do salário (tabela, oficial ou ausente), o valor da hora e a HE cheia.
  - Tipos do Node só no harness e nos testes (`tsconfig.test.json`); o código do motor compila sem eles.
- O M3 começou empilhado no M2 (`feat/m3-motor` a partir de `feat/m2-cidades-cct`), pela mesma pendência do CI.
- **Pendência externa (para resolver no futuro):** o CI do GitHub está bloqueado por cobrança da conta (Billing & plans). Os PRs seguem empilhados (#1 M0 → #2 M1 → M2) e só entram na `main` quando o CI rodar verde.

### M4 — Carga de dados (21/10/2026)
- **Formato dos arquivos:** layout padrão do ITO agora — modelo .xlsx para baixar na tela (folha por competência com matrícula, função e rubricas; ponto; VT; realizado do ERP) e XML de NF. Os adaptadores para as exportações reais do sistema de folha e do ERP entram quando chegarem amostras anonimizadas; **o aceite com a Mart Minas Paracatu fica pendente até lá**.
- **Quem carrega:** DP/RH, controladoria e admin; os demais perfis só leem (regra no banco).
- **Arquivos originais não são guardados:** a leitura descarta nomes e guarda só os dados com matrícula (regra 2). Para recarregar, envia-se o arquivo de novo.
- **Rascunho da carga no banco, por usuário:** guarda só dados lidos (sem nomes) e as escolhas de mapeamento; quem carrega vê os próprios, admin vê todos.
- **Leitura no navegador** (`packages/carga`, puro): o arquivo com nomes não sai da máquina de quem carrega; só os dados com matrícula vão para o rascunho e para o banco. Substitui, para a carga, a "biblioteca .xlsx no servidor" da stack. (auto — recomendado)
- **Gravação só pela função `gravar_carga`** (uma transação; pendências bloqueantes recusadas no banco); as tabelas da base histórica são só leitura pela API. Código de obra repetido exige confirmar a substituição. (auto — recomendado)
- **Layout da folha:** abas Rubricas, Pessoas e Resumo; HE por tipo pela nova coluna `rubricas.tipo_he` (200/201/205/210 já classificadas). Quantidades = inversas das fórmulas do motor (SPEC §6.4). (auto — recomendado)
- **Bloqueia:** proventos × resumo com diferença, função/rubrica pendente, competência fora do período, NF sem competência e diferença com o ERP sem justificativa. **Alerta:** ponto × folha, VT ausente e conferência rubricas × custo. MDO realocada sem destino passou a bloquear na revisão. (auto — recomendado)
- **Apropriação × ERP** = caixa do ITO (tabela da época) × soma das contas do ERP, por mês. (auto — recomendado)
- Funções por prestador **S/P** são marcadas na etapa Funções; a obra de destino da MDO realocada é uma obra da base ou "fora da base" (mantém o nome). (auto — recomendado)
- Coluna "Obras" de Funções (pendente do M1) entrou como "N obras" na segunda linha da função (regra 8), pela view `funcao_obras`. (auto — recomendado)
- Revisão do M4 (21/10/2026):
  - **Remuneração por matrícula** (`lancamentos`, `lancamento_rubricas`) só é lida por quem carrega; os demais perfis leem os agregados (LGPD). (auto — recomendado; **confirmar com a diretoria**)
  - Matrícula com ao menos um número; destino da MDO realocada obrigatório (da base ou "fora da base", confirmando o texto da folha).
  - `gravar_carga` confere o mês de todas as listas e soma o ERP no banco; rascunho guarda as leituras numa coluna própria (só sobe quando um arquivo muda).
  - Aceito sem correção: sinônimo existente remapeado na carga troca a função dele (é a escolha explícita de quem carrega); substituir uma obra desfaz o vínculo `outra_obra_id` de realocações de outras obras (o nome fica).
- Comparação com o protótipo (21/10/2026):
  - **Período por competência** (mês/ano de início e término), não por dia: a fração do primeiro e do último mês vem dos dias de vínculo de cada pessoa na folha. A etapa Obra pode seguir sem datas e a folha preenche o período. (auto — recomendado)
  - **Arquivos em qualquer ordem**; remover a folha tira só a folha. (auto — recomendado)
  - **Tipologia em lista fechada** (as 5 do protótipo) e **grupo da obra** (mm, galpão, academia, outras) deduzido de cliente e tipologia por gatilho no banco, como no protótipo. (auto — recomendado)
  - Cliente vazio fica vazio no banco; as telas da base histórica (M5) mostram "Sem cliente". Função criada no assistente nasce "direta", como no protótipo (ajuste em Funções). (auto — recomendado)
  - Área a partir de 100 m²; troca de tabela sugere a data-base seguinte; criar função segue o protótipo (até 3 palavras, sufixo no código, "Função “X” criada e mapeada").
  - Mantido diferente: sem a aba Pessoas o ITO não sabe quem trabalhou; "NF não enviadas" diz "sem conferência" (o custo S/P vem do regime, não das notas); etapa 2 exige a etapa 1 completa (menos as datas).
- **Risco do aceite:** com folha real, a conferência rubricas × custo compara a folha com o custo modelado pelo motor na tabela da época; pode não fechar no centavo. Avaliar quando chegarem as amostras.
- O M4 começou empilhado no M3 (`feat/m4-carga` a partir de `feat/m3-motor`), pela mesma pendência do CI.

### M5 — Base histórica e detalhe da obra (21/10/2026)
- **Edição de premissas e ausências** da obra: quem carrega (DP/RH, controladoria, admin); os demais perfis só leem (regra no banco). (auto — recomendado)
- **Abas por matrícula** (painel de matrículas do Efetivo, Pessoas e valores por matrícula da Folha): quem não carrega vê só os agregados, com aviso (coerente com a privacidade do M4). (auto — recomendado)
- **Resumo da obra em cache no banco** (pico, pessoa-mês, HE/pessoa, custo época e atualizado, histograma), calculado pelo motor ao gravar ou editar a obra e recalculado quando a tabela vigente muda; a lista de 1.000 obras lê só o resumo. (auto — recomendado)
- **Edição grava ao sair do campo** ("Salvo"), como no M1, com recálculo imediato na tela. (auto — recomendado)
- Tabelas **mês a mês** do detalhe da obra (24+ colunas) rolam dentro do próprio cartão, com a primeira coluna fixa; a página e as tabelas principais (base, médias por função) não rolam de lado (regra 8). (auto — recomendado)
- Apropriação × ERP no detalhe usa os valores gravados na carga (caixa do ITO × ERP, M4); a tabela por conta mostra a competência da época, como no protótipo. MDO realocada e justificativas ficam como a carga gravou (só leitura no M5). (auto — recomendado)
- Revisão do M5 (21/10/2026):
  - **Resumo em cache** guarda a impressão digital dos parâmetros (tabelas, funções, benefícios, calendário) e a revisão da obra: editar um salário ou encargo deixa o resumo velho, e o banco só grava o resumo calculado sobre a revisão atual. Quem só lê recalcula na tela só a página que está vendo. (auto — recomendado)
  - Troca de tabela editada na obra precisa cair no período; funções transferidas precisam existir; resumo sem números negativos.
  - Aceito sem correção: quem carrega ou a controladoria pode gravar um resumo com números quaisquer (modelo de confiança interno; o detalhe da obra sempre recalcula pelo motor).
- Comparação com o protótipo (21/10/2026):
  - **Por matrícula** (painel de matrículas e aba Pessoas): mostra o que a folha traz (remuneração nas rubricas que entram no custo, HE, faltas), sem recalcular encargos, provisões e benefícios pessoa a pessoa. (auto — recomendado)
  - **Seleção da base** fica na tela; guardá-la para o "Comparar com…" juntar obras fica para o M6. "Nova projeção →" já leva a Projeções (M7). (auto — recomendado)
  - Base abre em **Todas** (o protótipo abria em Mart Minas por ser o exemplo); Comparar aceita até 4 obras; competência/caixa no topo das abas. (auto — recomendado)
  - Absenteísmo médio ponderado pelo efetivo (como o protótipo e a projeção); preferências de eixo, barras e caixa lembradas no navegador.
  - Convenção de tela aceita (regra 8): colunas juntas com segunda linha em `sub` em Folha, Pessoas, Apropriação, Realocada e Médias por função; data de feriado digitada (dd/mm/aaaa); KPI de custo em âmbar claro (o "deep" escuro do protótipo fica para o design system).
  - Mantido diferente: MDO realocada e justificativas do ERP só leitura no M5 (vêm da carga); a troca de tabela edita a tabela, e o mês se troca removendo e incluindo.
- O M5 começou empilhado no M4 (`feat/m5-base-historica` a partir de `feat/m4-carga`), pela mesma pendência do CI.

### M6 — Comparar obras (21/10/2026)
- **Seleção compartilhada** entre a base e a comparação, guardada na sessão do navegador (por aba); "Comparar com…" na obra junta a obra às já selecionadas. (auto — recomendado)
- **Eixo** em mês relativo (M1, M2…) por padrão, como no PRD, com a opção "% do prazo" do protótipo; curvas de efetivo por 1.000 m² e curva S de custo, a valores vigentes. (auto — recomendado)
- **Escolha das obras** com busca (até 4), não uma lista de botões de todas as obras (regra 7). (auto — recomendado)
- Revisão e comparação do M6 (21/10/2026):
  - **Histograma** (barras agrupadas por obra) quando o eixo é o mês relativo e a curva é o efetivo, como pede o PRD; em % do prazo e na curva S, linhas como no protótipo. (auto — recomendado)
  - "Comparar com…" põe a obra na frente da seleção (a comparação mostra as 4 primeiras obras que existem); a base aceita mais de 4 selecionadas e a comparação avisa. A seleção é limpa ao sair. (auto — recomendado)
  - Linha "R$ por dia · todas as funções" além do pedreiro; seção "Mix de funções" e "Projetar com estas →" como no protótipo; escolha de obra só confirmada (lista ou Enter), com cliente e início para diferenciar nomes iguais. (auto — recomendado)
  - Percentuais com 2 casas (convenção do ITO, como 43,96%), não 1 como no protótipo; cores das obras da paleta de séries do Canteiro.
- O M6 começou empilhado no M5 (`feat/m6-comparar` a partir de `feat/m5-base-historica`), pela mesma pendência do CI.

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
