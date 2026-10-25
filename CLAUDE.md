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
- **CI e merges (22/10/2026):** o repositório ficou público por decisão do usuário para o CI do GitHub rodar sem cobrança; os PRs #1 a #11 entraram na `main` com CI verde, um a um, com as migrações aplicadas na produção antes de cada merge.

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

### M7 — Projeções (21/10/2026)
- **Quem edita:** planejamento, engenharia, controladoria e admin criam e editam projeções; DP/RH e diretoria leem. Marcar **Aprovada** só controladoria, diretoria ou admin (regra no banco). (auto — recomendado)
- **"Copiar para Excel"** copia para a área de transferência em texto tabulado no formato BR (cola direto no Excel); o arquivo .xlsx fica para o M8. (auto — recomendado)
- **"5 mais parecidas":** mesma tipologia primeiro, depois área e prazo mais próximos (distância em escala logarítmica). (auto — recomendado)
- **Guarda só as entradas** da projeção; o motor recalcula na tela. Um resumo (total, pico, pessoa-mês) é gravado junto para a lista. (auto — recomendado)
- **Segurança da aprovação (revisão do banco):** projeção aprovada não é editada nem apagada (só o resumo é recalculado); sair de Aprovada também exige quem aprova; autor, datas e situação inicial vêm do banco; `definir_situacao` trava a linha (sem corrida).
- **Cidade obrigatória** no passo 1 do assistente (preços vêm dela); o banco aceita projeção sem cidade (tabela da empresa). Quem vem de fora todo dia sai de **BH** por padrão (como o protótipo), trocável no passo 3. (auto — recomendado)
- **Editar** abre o assistente no passo 3; mudar início ou prazo descarta o reajuste informado que sair do prazo e ajusta as quantidades informadas ao novo prazo. (auto — recomendado)
- **Resumo da lista** é o do último cálculo; ao abrir a projeção, quem edita regrava o resumo se os preços mudaram. A lista mostra a CCT do resumo quando ela não é a vigente. (auto — recomendado)
- **Comparar projeções:** até 4, pela seleção na lista (endereço `/projecoes/comparar?ids=`), com os preços vigentes da cidade de cada uma; diferença de custo contra a primeira. (auto — recomendado)
- **Copiar para Excel** copia a tabela de custo que está na tela (por função ou por componente, competência ou caixa). (auto — recomendado)
- Revisão do M7 (21/10/2026):
  - **Resumo de projeção aprovada** só é regravado por quem aprova e edita (controladoria, admin), regra no banco. Nas demais situações, quem projeta grava o resumo (modelo de confiança do M5; a tela sempre recalcula).
  - Resumo e "Salvar" esperam as referências carregadas de fato (o dado provisório da projeção anterior não entra no cálculo).
  - Reajuste informado precisa de ao menos 2 meses de prazo; a tela lista todos os reajustes da data-base no prazo (compostos) e avisa que o informado substitui todos.
- Comparação do M7 com o protótipo (21/10/2026):
  - **R$ por dia** mostra o pedreiro, com servente e todas as funções na segunda linha (como o protótipo e o M6). (auto — recomendado)
  - **Trocar a cidade descarta o reajuste informado** (outra CCT, outra data-base), como o protótipo. (auto — recomendado)
  - **Tipologia em lista fechada** (as 5 do M4); área a partir de 100 m² (como a carga); prazo de 1 a 120 meses (o stepper de 3 a 24 do protótipo era ilustrativo). (auto — recomendado)
  - Candidatas a referência mostram **PM / 1.000 m²** (como o protótipo), com o R$/m² vigente na segunda linha. (auto — recomendado)
  - Reajuste informado aceita de −50% a 100% (como a CCT no M2) e começa no 2º mês (o banco exige mês ≥ 1). (auto — recomendado)
  - "Informar quantidades" parte das quantidades das referências, se houver; Premissas aplicadas, histograma (grupo, empilhadas/agrupadas), efetivo (PM/1.000 m², S/P), origem (alojamento e viagens), comparação (provisões, custo/pessoa·mês, situação) completados como no protótipo.
  - Ficou de fora: contagem de feriados em dias úteis nas premissas aplicadas (o calendário já entra no custo).
- O M7 começou empilhado no M6 (`feat/m7-projecoes` a partir de `feat/m6-comparar`), pela mesma pendência do CI.

### M8 — Exportações e relatórios (21/10/2026)
- **.xlsx com números de verdade** e formato contábil brasileiro nas células (R$ com 2 casas, pessoa-mês com 1 casa, percentual); os códigos de formato do arquivo são neutros e o Excel em português mostra 1.234,56 sem reformatar. Gerado no navegador (`write-excel-file`, já usado na carga). (auto — recomendado)
- **O que exporta:** da obra, efetivo, custo por função e por componente, rubricas e apropriação; da projeção, um arquivo com premissas, efetivo, custo por função, por componente e "trazer gente de fora". (auto — recomendado)
- **Rubricas exportadas agregadas** por rubrica e mês, sem matrícula, e só para quem carrega (DP/RH, controladoria, admin), porque a folha por rubrica já é restrita a eles na tela (M4/M5). Os demais exportam sem a aba Rubricas. (auto — recomendado)
- **Copiar para Excel** nas tabelas mês a mês principais da obra, com o mesmo texto tabulado BR do M7. (auto — recomendado)
- **PDF da projeção** = página de impressão (`/projecoes/:id/imprimir`) com folha de estilo de impressão; o navegador salva em PDF. Sem biblioteca nova; fontes Geist e formato BR iguais aos da tela. (auto — recomendado)
- Comparação do M8 com o protótipo (21/10/2026):
  - **Copiar na projeção** leva as 3 tabelas do protótipo (efetivo, custo por componente e por função, na visão da tela), cada uma com o nome numa linha antes; nas abas da obra, a tabela da aba. (auto — recomendado)
  - Sem área de transferência (HTTP, permissão negada), a cópia usa o plano B do navegador, como o protótipo; se falhar também, sugere o .xlsx. (auto — recomendado)
  - **PDF de uma página, em competência** (o custo aprovado); curva S e projeção × referências ficam na tela e no .xlsx. (auto — recomendado)
  - Comparar projeções não exporta (o PLAN não pede); a diretoria lê a comparação na tela. (auto — recomendado)
- Revisão do M8 (21/10/2026):
  - **Totais da planilha fecham com a soma das células:** R$ arredondado em centavos antes de somar (o total pode diferir do motor em centavos, nunca da soma do Excel).
  - **PDF sempre numa página:** com mais de 12 meses, a tabela de custo agrupa os meses (trimestres, semestres…) e mostra o pico de cada período.
  - Cabeças exportadas como inteiros; apropriação exportada com o mesmo filtro de contas da aba; reajustes com o mesmo texto na tela, no .xlsx e no PDF; página de impressão mostra erro de carga em vez de esperar para sempre.
  - Aceito sem correção: o resumo impresso não usa a tabela da empresa enquanto a CCT carrega (os preços só existem com a CCT da cidade carregada).
- O M8 começou empilhado no M7 (`feat/m8-exportacoes` a partir de `feat/m7-projecoes`), pela mesma pendência do CI.

### M9 — Migração do histórico (21/10/2026)
- **Base de dados:** o zip "Histogramas das Obras" (31 planilhas, ~23 obras de 2017 a 2026), entregue pelo usuário. Dois modelos, ambos com uma linha por pessoa e mês: **.xlsm "Histograma de Mão de Obra"** (2017–2020; aba Folha) e **.xlsb** (2023–2026; aba Histograma com uma coluna por código de rubrica). O PLAN previa só o .xlsm.
- **Ampla e Clássica** são construtoras do mesmo grupo e, numa mesma obra, há gente fichada em cada uma. As planilhas Ampla e Clássica da mesma obra (Super Luna Betim, BH Passos, MM Ibirité, Cananeias) viram **uma obra só**, mas **cada lançamento guarda a construtora** em que a pessoa estava fichada (campo próprio, parte da chave, para matrículas iguais nas duas não colidirem), para o controle ficar apurado. Planilha sem rótulo = Clássica; Barreiro (só Ampla) = obra com todo o efetivo na Ampla. Nenhum dado fica para trás. (usuário)
- **Duplicatas** (Betim II repetida, Varginha V0/V7, Galpão Serrano normal/SP, Paquetá normal/sem encargos): vale a **versão mais recente**; o relatório lista o que ficou de fora. (usuário)
- **Destino:** carga local, conferência e depois **homologação** (`ito-homologacao`). Produção só com OK do usuário. (usuário)
- **Ferramenta:** script local de migração (`packages/migracao`), não uma tela: converte cada planilha para o layout de folha do ITO e grava pelo mesmo caminho da carga (verificações do M4 e `gravar_carga`). Nomes são descartados na leitura; nada com nome sai da máquina (regra 2). (auto — recomendado)
- **Dados da obra** que a planilha não traz (área, cidade, tipologia) ficam numa tabela versionada (`docs/migracao/obras.csv`, sem dado pessoal); o que faltar vira pendência no relatório. (auto — recomendado)
- **Funções fora das 14** (engenheiro, gerente administrativo, comprador, RH, moto boy, topografia, pintor, serralheiro, operador de betoneira, supervisor, técnico de enfermagem, serviços gerais, planejamento): **viram funções novas** no grupo certo; variações ("PEDREIRO A", "PEDREIRO 2", "MEIO OFICIAL") vão para a função existente, como sinônimo. A controladoria cadastra o salário das novas (até lá o custo usa o do oficial). (usuário)
- **Cidades ausentes** (Ubá, Lavras, Pará de Minas, Varginha, Betim, Ibirité, Sarzedo, Lagoa Santa…) são criadas ligadas à CCT da região, com VT e ISS a revisar pela controladoria. (usuário)
- **Área (m²):** o usuário preenche `docs/migracao/obras.csv`; a migração carrega as obras com área e lista as demais como "aguardando área"; rodar de novo substitui e completa. (usuário; o banco exige área > 0)
- **Leitura por nome de coluna** no .xlsm (as versões v04–v20 mudam a posição das colunas); linhas sem função e sem salário ("0", "N/A", vazio) são linhas vazias da planilha e ficam de fora; a coluna "Adicionais de MO" do .xlsb traz nomes e **não é lida** (o valor vai só como total no relatório).
- **.xlsb sem horas:** HE e faltas em horas são estimadas pelo valor ÷ (salário base ÷ 220 × adicional), marcadas como estimadas no relatório. (auto — recomendado)
- **Obras de 2016 a 2022** entram com a tabela da empresa de 2023 como "época" (marcadas no relatório) até a controladoria cadastrar as data-bases daqueles anos; aí basta trocar a data-base da obra. As projeções não mudam (quantidades do histórico, preços vigentes). (usuário)
- **Conferência da migração:** proventos lidos × coluna "Proventos" de cada planilha .xlsb e efetivo do ITO × histograma da aba Resultados do .xlsm, por mês, no relatório. No .xlsm, dias de referência vazios = não trabalhou no mês (pessoa-mês zero), como a própria planilha. (auto — recomendado)
- **Área provisória de 10.000 m² em todas as obras** (usuário): os indicadores por m² (PM/1.000 m², R$/m²) não comparam obras de tamanhos diferentes até as áreas reais entrarem em `docs/migracao/obras.csv` (rodar a carga de novo substitui). Cidades confirmadas pelo usuário: Blue Light, Jacuí, Paquetá e Galpão Dalias em BH; Hort Fruti em Contagem; BH Passos em Passos (cidade nova, CCT Sul de Minas). Matrícula normalizada na leitura ("1152 A" → "1152A").
- Revisão do M9 (21/10/2026), carga refeita no local e na homologação:
  - **Colunas de rubrica do .xlsb param no primeiro título de total** (Proventos, Descontos, ∑ Custo, FGTS, Provisões, INSS empregado/empregador, Pagamento salarial…), mesmo nas planilhas sem a coluna "Proventos"; antes, totais e encargos entravam como provento. As colunas fixas (matrícula, função, competência, salário base) são conferidas pelo cabeçalho e a planilha fora do layout é recusada.
  - **Mesma rubrica só com nome igual** (sem acento, ordinal e pontuação) ou diferente só por um percentual no fim; prefixo solto não vale ("13 SALARIO INTEGRAL" não é a 8550 de rescisão). "Dias faltas" é quantidade (informativo).
  - Rubricas que a própria migração criou (código ≥ 9500) e saíram da tabela são apagadas na carga, se não tiverem lançamento.
  - Aba Pessoas e VT separados por construtora (a mesma matrícula na Clássica e na Ampla são duas pessoas).
  - A carga só substitui obra carregada pelo mesmo usuário; carga de outra pessoa pede `--substituir`.
  - Em `funcoes.csv` e `rubricas.csv`, só a linha com **revisado = sim** (marcada pelo DP/RH) manda sobre as regras; o resto é sugestão regerada a cada execução.
- O M9 começou empilhado no M8 (`feat/m9-migracao` a partir de `feat/m8-exportacoes`), pela mesma pendência do CI.

### M10 — Endurecimento (21/10/2026)
- **Auditoria no banco:** gatilho genérico grava em `auditoria` (tabela, registro, operação, versão anterior e nova em JSON, quem, quando) nas tabelas de configuração (data-bases, salários, benefícios, encargos, calendário, funções, rubricas, cidades, CCTs), nas premissas e ausências da obra, nas projeções e nos usuários. Lançamentos por matrícula ficam fora (LGPD; a carga já registra quem carregou). Ninguém edita nem apaga a auditoria pela API; guarda para sempre. (auto — recomendado)
- **Quem lê a auditoria:** admin, controladoria e diretoria, numa tela "Auditoria" com busca, filtros (módulo, pessoa, período) e paginação, e um "Histórico" no detalhe da data-base, da CCT, da obra e da projeção mostrando a versão anterior. Sem botão de restaurar: para voltar, edita-se de novo (fica auditado). (auto — recomendado)
- **Performance:** gerador de dados sintéticos (1.000 obras, 100 CCTs, 500 cidades, só matrícula) para o banco local, com metas medidas em teste: projeção recalculada em < 300 ms e base histórica, cidades e CCTs abrindo sem travar (paginação no servidor onde a lista crescer). (auto — recomendado)
- **Acessibilidade:** varredura automática com axe (Playwright) nas 10 rotas e na tela de usuários, nos modos claro e escuro, sem violação séria ou crítica; navegação por teclado nos fluxos principais (menu, busca Ctrl+K, abas, diálogos). (auto — recomendado)
- **Backup:** os backups diários do Supabase são a primeira linha; além deles, `pnpm db:backup` gera um dump (esquema + dados) de homologação ou produção numa pasta fora do repositório, e a restauração é ensaiada no banco local e descrita em `docs/OPERACAO.md`. (auto — recomendado)
- **Usuários:** convite pelo e-mail do Supabase Auth (link para definir a senha), por uma Edge Function `usuarios` que confere se quem chama é admin; desativar = bloquear o login no Auth e marcar `ativo = false` (a autoria fica); último acesso vem do Auth. Só admin vê a tela. (auto — recomendado)
- **Tabela de permissões** servida pelo banco (função `permissoes()`: módulo × perfil → lê, edita, aprova e limitações) e mostrada na tela de usuários; um teste de banco percorre cada perfil (com e sem admin) e falha se a tabela divergir do que as funções `pode_*` e a RLS realmente deixam. (auto — recomendado)
- Revisão do M10 (22/10/2026), corrigido:
  - **Autoria** das ações da função de usuários (convidar, desativar, reativar) = o admin que chamou (`gerir_usuario` + `autor_atual()`); a criação da conta pelo Auth fica sem autor.
  - **A carga registra os cadastros que muda** (sinônimos, rubricas novas); só as linhas por mês da obra ficam fora. **Resumo da projeção** regravado ao abrir não entra na auditoria.
  - Auditoria **imutável também para a chave de serviço** (gatilho), política de leitura sem chamada por linha, busca por pessoa com espera de 300 ms; valores em R$ e % e campos com nomes legíveis; histórico de Parâmetros = toda a tabela da empresa.
  - **Link de senha:** vale 1 hora (texto do e-mail corrigido); "Enviar link de senha" na lista (convite de novo ou troca de senha) e "Esqueci a senha" no login; convite pendente = ainda sem senha. SMTP próprio documentado como obrigatório em produção.
  - Teste de permissões faz a **operação real de cada módulo** por perfil (conferido com mutação); trava contra dois admins se removerem ao mesmo tempo; ordenação na lista de usuários.
  - Scripts: backup só para o dono e sem sessões, pasta em outro disco aceita; restauração pede `--confirmar`; gerador de desempenho completa o que falta sem colidir ids.
  - Aceito: quem lê a auditoria vê o e-mail de quem alterou (é a trilha); o gerador de desempenho deixa linhas de auditoria no banco local.
- O M10 começou empilhado no M9 (`feat/m10-endurecimento` a partir de `feat/m9-migracao`), pela mesma pendência do CI.

### Depois do M10 (23/10/2026)
- **Sem classificação de funções** (decisão do usuário): o ITO não divide mais as funções em direta, indireta e administrativa — saíram os filtros Todas/Direta/Indireta/Adm., os subtotais por grupo, os indicadores "Direta · indireta · adm." e "% MO indireta", a coluna e o filtro do cadastro de Funções, a coluna "Grupo" do .xlsx e o campo no banco (`funcoes.grupo`, `obra_resumo.indireta_pct`). O custo não muda: crescer com a área continua no campo **escala com a área** de cada função; função nova nasce escalando com a área (como a antiga "direta"), ajustável no cadastro. Tabelas listam as funções em ordem alfabética.
- **Menu lateral recolhível** (só ícones, clicáveis, lembrado no navegador) e conteúdo na largura toda da tela; percentuais ao lado de valores em R$ em cinza, menores e afastados.

### M11 — Obras em andamento (24/10/2026)
- **Obra acompanhada mês a mês** (usuário): a obra pode começar no ITO e receber folha, ponto, VT, notas e ERP a cada competência; a carga da obra inteira continua.
- **Situação da obra** em andamento ou concluída; as obras já carregadas ficam concluídas. (auto — recomendado)
- **Lançamento mensal** no detalhe da obra, com as mesmas conferências da carga, uma competência por vez; refazer um mês substitui só aquele mês, sem perder premissas e ausências. (auto — recomendado)
- **Projeções usam só obras concluídas** como referência (curva completa); base e Comparar mostram as duas com filtro e selo. (auto — recomendado)
- **Quem lança o mês** = quem carrega (DP/RH, controladoria, admin). (auto — recomendado)
- **Sem "obra fora da sede (alojamento)"** (usuário): alojamento e viagens dependem de cada função, não da obra; na projeção continuam pela origem de cada função.
- **Rascunhos da carga em painel lateral** aberto por ícone (usuário).
- **Um mês por vez, sem pular:** lança-se o mês seguinte ao último ou refaz-se um já lançado. Concluir fecha o período no último mês lançado; reabrir volta a receber meses. (auto — recomendado)
- **Rotatividade e mix de HE** da obra em andamento são recalculados com todos os meses a cada mês lançado (são quantidades da folha); edição nas premissas vale até o próximo lançamento. (auto — recomendado)
- **Começar em andamento:** início e prazo previsto (opcional, informativo); a folha dos meses que já passaram é opcional e o período vai do início à última competência dela. (auto — recomendado)
- **Lançar mês** é uma tela própria (`/obras/:id/lancar`) com as etapas da carga, sem rascunho (refaz-se enviando de novo); notas fiscais enviadas no lançamento são do mês; a verificação confere só o mês, sobre a obra inteira. (auto — recomendado)
- **Base histórica:** obras em andamento contam na quantidade, mas ficam fora da duração e das médias; filtro de situação aparece quando há obra em andamento. Comparar aceita obra em andamento com mês lançado, com selo. (auto — recomendado)
- Aceito: tirar o S/P de uma função no lançamento não tira o S/P da obra (faz-se nas premissas).
- Revisão do M11 (24/10/2026), corrigido:
  - **Lançar ou refazer é explícito** no pedido: se outra pessoa lançou o mês no meio, o banco recusa ("Atualize a página") em vez de trocar a folha calada.
  - **Refazer um mês parte as realocações de vários meses** (da carga inteira ou de obra reaberta); o saldo de VT fica na primeira parte.
  - Resumos das obras que tinham "fora da sede" ficam velhos na migração (o custo delas mudou). Lançar mês grava só os feriados municipais do próprio mês; com 120 meses, a tela abre no último mês.
  - Projeção com referência reaberta mostra aviso; editar a projeção avisa que a obra em andamento saiu das referências.
- Aceito sem correção: a verificação do mês usa o mix de HE do próprio mês (o banco grava o de todos os meses; o detalhe recalcula); NF de outra competência enviada no lançamento entra no mês; desmarcar S/P no lançamento não tira o S/P da obra (faz-se nas premissas); troca de tabela entra pelas premissas depois do mês lançado (refaça o mês se ela valer para ele).
- Fica para depois: acompanhar o realizado contra a projeção aprovada da própria obra.

### Projeções em 6 passos (24/10/2026, usuário, a partir do protótipo aprovado)
- O passo Ajustes virou três: **Histograma** (gráfico fixo no topo ao rolar, lado a lado por padrão; quantidades numa tabela só, já preenchidas pelas referências, com a régua **Mais ou menos** por função (−100% a +100%, sobre a linha inteira) e cada mês digitável; digitar um mês fixa a linha e zera a régua dela; "Incluir função" para funções fora da sugestão; as obras de referência continuam no resultado), **Origem da MO** e **Premissas** (custo, regime e transferência, reajuste e calendário, HE). "Ajuste por função" passou a se chamar "Mais ou menos gente".
- **Pessoas sempre inteiras** nas projeções: até ,2 arredonda para baixo, de ,3 em diante para cima (SPEC §5, `pessoasInteiras` no motor); a validação diferencial aplica a mesma regra ao protótipo. Projeções salvas mudam de número ao serem abertas de novo.
- Editar uma projeção abre no passo Histograma. Sem digitar nada, a tabela segue as referências; o primeiro número digitado fixa o histograma informado (a régua passa a valer sobre ele). (auto — recomendado)

### M12 — Desempenho (24/10/2026)
- **Medir antes de mexer** (usuário, plano `ITO_Plano_Implementacao_Performance.md`): primeiro o baseline e a lista de gargalos; só depois correções, cada uma com o número de antes e depois. O que o plano genérico não cobre no ITO (atualização otimista, feature flags, Web Worker, virtualização) só entra se a medição pedir.
- **Medição sobre o build de produção** (`vite preview`), com os dados sintéticos do M10 (`pnpm desempenho gerar`) e as obras reais da homologação; a medição fica fora da suíte normal (`pnpm perf`). (auto — recomendado)
- **Sem dependência nova** para medir: Performance API do navegador e Playwright. Monitoramento em produção (Vercel Speed Insights) fica para decisão do usuário. (auto — recomendado)
- Correções do M12 (baseline em `docs/performance/baseline.md`): o resultado da projeção usa o **resumo em cache** das referências quando ele está em dia (6,4 s → 0,3 s com 1.000 referências) e mostra 50 linhas na tela (todas no .xlsx); a **impressão digital do resumo ignora a ordem** das listas e das chaves (tela e scripts gravavam impressões diferentes e a tela recalculava tudo); referências baixadas em até 4 lotes ao mesmo tempo (3,3 s → 1,8 s); detalhe da obra numa rodada de busca só. (auto — recomendado)
- Ficam para quando a medição na produção pedir: paginação da base no servidor (G5) e abrir o app carregando só os cadastros da tela (G6).

### M13 — Segurança (24/10/2026)
- **Base:** a auditoria do ITO (`AUDITORIA-2026-10-24.md`, revisão `4d242d7`) e o cruzamento com a auditoria do JETO. Cadastro público confirmado fechado na homologação e na produção (`disable_signup = true`).
- **MFA obrigatório** (usuário): administrador, controladoria e diretoria, com aplicativo autenticador (TOTP). Sem o segundo fator (sessão AAL1), essas contas não leem nem escrevem nada, também pela API: `sou_ativo`, `sou_admin` e `meu_perfil` exigem AAL2 delas. Demais perfis usam só senha. (auto — recomendado)
- **Perdeu o celular:** outro administrador zera o MFA pela tela de usuários (a pessoa se inscreve de novo no próximo login). Contas do seed local ficam dispensadas (`mfa_dispensado`, só a chave de serviço altera), menos a de teste do MFA. (auto — recomendado)
- **Projeção aprovada congelada** (S05): entradas e resumo travados depois da aprovação; mudanças de resumo auditadas. O cálculo autoritativo no servidor fica para depois: hoje o motor roda no navegador de quem aprova. (auto — recomendado)
- **Aprovada congelada também para quem aprova:** o resumo não é regravado depois da aprovação, nem pela controladoria; aprovar e mudar números no mesmo passo é recusado. Com preços novos, a tela avisa o total aprovado e o de hoje; para aprovar o novo, volta-se a Em análise. A aprovação fica na auditoria com os números. (auto — recomendado)
- **AAL2 só com a sessão viva:** para quem precisa de MFA, o token vale enquanto a sessão dele existir no Auth; zerar o MFA, desativar ou sair derrubam o acesso na hora (antes, o token valia até expirar). (auto — recomendado)
- **Link de senha pela conta do Auth** (UUID): convite de novo só para quem nunca confirmou; os demais recebem a recuperação, que não cria conta. E-mail do cadastro acompanha o do Auth (gatilho). (auto — recomendado)
- **Contratos e limites:** o banco recusa JSON da projeção fora do formato da tela e do motor. Limites com folga sobre a maior obra real: planilha até 50 MB e 30 abas, 2.000 XMLs de até 2 MB (sem DTD), carga até 100 MB, rascunho até 60 MB e 20 por pessoa, 5.000 resumos por chamada. (auto — recomendado)
- **Permissões padrão fechadas:** tabela, função ou sequência nova no `public` nasce sem acesso para `anon`, `authenticated` e `public`. Toda migração nova concede explicitamente o que a tela usa (`grant`) e liga a RLS; `privilegios.test.sql` falha se uma tabela ficar sem RLS ou algo ficar aberto ao `anon`. (auto — recomendado)
- **Backup cifrado** (`pnpm db:backup … --cifrar`, frase em `ITO_BACKUP_CHAVE`, guardada no cofre); segredos do Auth (MFA, sessões, tokens) ficam fora do dump: depois de restaurar, cada pessoa entra de novo e reinscreve o MFA. (auto — recomendado)
- Revisão do M13 (25/10/2026), corrigido:
  - **Aprovar grava os números da tela de quem aprova** (`definir_situacao` com o resumo, auditado no mesmo passo); o resumo gravado antes, velho ou forjado pela API, não vira o aprovado. O botão "Aprovada" espera o cálculo terminar.
  - **Contratos aceitam as chaves antigas** `resumo.indireta_pct` e `premissas.foraDaSede` (projeções salvas antes de 23/10 e do M11): sem isso, a migração e o restauro de backups antigos falhariam.
  - Tela não consulta o banco antes de saber se falta o MFA e relê tudo ao confirmar o código; zerar o MFA recusa a própria conta e grava antes de mexer no Auth; `ITO_SITE_URL` obrigatório fora do local (segredo da função); restauro lê a frase de `.env.supabase.local`; dump aberto apagado mesmo se a cifragem falhar; célula do histograma com até 5 dígitos; grants explícitos das funções dos CHECKs, com teste.
  - Aceito: o limite de 30 abas é conferido depois da leitura (o limite de 50 MB, antes dela, é o que protege o navegador).

### M14 — Segurança e desempenho, o que faltou (25/10/2026)
- **Tudo o que couber no código e nas ferramentas do projeto** (usuário). Fica com o usuário o que só ele faz: MFA das contas do GitHub, da Vercel e do Supabase; restrição de rede do banco (bloquearia as migrações feitas daqui, de IP variável); plano e add-on de PITR.
- **Aprovação no servidor:** Edge Function `projecoes` com o mesmo motor e os mesmos carregadores da tela, empacotados por esbuild num arquivo gerado (`supabase/functions/projecoes/calculo.gerado.js`, conferido no CI); cada aprovação fica em `projecao_aprovacoes` com resumo, entradas, preços e versão do cálculo (hash do código); `definir_situacao` não aprova mais. (auto — recomendado)
- **Monitoramento próprio no banco** em vez do Vercel Speed Insights (dependência e custo): métricas sem dado pessoal, 90 dias. (auto — recomendado)
- **Ficam para quando o monitoramento da produção pedir:** paginação da base no servidor (G5), cadastros só da tela aberta (G6), cálculo em Web Worker, virtualização e feature flags; voltar uma publicação é pelo "Instant Rollback" da Vercel (documentado). (auto — recomendado)

## Design system "Canteiro" (ITO)

- Cores:
  - âmbar `#F2B705` = **ação** (botão primário, destaque);
  - grafite `#1F2226` = **estado ativo** (chip ou aba selecionada, toggles ligados);
  - interruptor ligado = trilho grafite com bolinha branca (no escuro, trilho claro com bolinha escura); o âmbar fica só para ação (usuário, 24/10/2026);
  - texto âmbar sobre claro: `#8A6400`.
- Tipografia: **Geist** no texto e **Geist Mono** nos rótulos, em caixa alta espaçada.
- Formas: pills (`999px`) para botões, chips e segmentos; cartões com raio de 20 px.
- Modo claro e escuro, com tokens definidos nos dois. Gráficos de série usam a cor de cada função (cadastro de Funções).

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
