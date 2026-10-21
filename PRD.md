# ITO — PRD (Documento de Requisitos do Produto)

> Versão 2.0 · outubro/2026 · Clássica Engenharia
> Referência visual e funcional: protótipo navegável **ITO 2.0** (artifact). Em caso de dúvida de comportamento, o protótipo é a referência; as regras de cálculo estão no `SPEC.md`.

---

## 1. Visão

O ITO guarda, em forma de dados, a história da mão de obra de cada obra concluída: quantas pessoas de cada função trabalharam em cada mês, quanto custaram e por quê (salário, adicionais, horas extras, encargos, provisões, benefícios, exames, rescisões, tributos). Com essa base, projeta o **histograma** e o **custo mensal de mão de obra** de obras futuras.

A regra que organiza o produto:

> **Do histórico vêm as quantidades. Dos parâmetros vêm os preços.**
> Pessoa-mês por função, horas extras, faltas, rotatividade, licenças e férias vêm de obras parecidas. Salários, gratificações, benefícios, VT, encargos, adicionais e data-base vêm da **cidade da obra** (e da CCT que vale nela) e da **tabela da empresa**.

Mesma filosofia do EEX (banco de quantitativos estruturais): o ITO não é ERP nem folha de pagamento. É um banco de conhecimento para planejar com base no que já aconteceu.

### 1.1 Problema

- O controle hoje é feito na planilha **"Histograma de Mão de Obra"** (.xlsm; versões MM Ubá v10 e AF v07). Cada obra tem uma planilha. Não dá para comparar obras, tirar médias nem reaproveitar o histórico.
- As duas versões da planilha têm naturezas diferentes:
  - a **v10** apura o realizado no nível da folha (uma linha por funcionário por competência);
  - a **v07** é de planejamento e trabalha com percentuais.
- O ITO precisa cobrir as duas e **não pode ter menos controle nem menos detalhe que nenhuma delas**.
- Orçar mão de obra para outra cidade exige saber a CCT local, o VT e se a mão de obra vem de fora. Hoje isso é feito à mão.

### 1.2 Objetivos

1. Ter a base histórica de MO de todas as obras, conferida contra a folha e contra o ERP.
2. Projetar o histograma e o custo mensal de uma obra nova em minutos, a partir de obras parecidas.
3. Aplicar automaticamente os preços da cidade da obra, incluindo reajuste na data-base da CCT dentro do prazo.
4. Comparar cenários: obras entre si, projeções entre si e origens da mão de obra (local, vinda de fora todo dia, alojada).

### 1.3 Métricas de sucesso

- Conferência rubricas × custo do ITO **fecha em R$ 0,00** em 100% das obras carregadas.
- Uma projeção completa (cidade + referências + premissas) em até **10 minutos**.
- Desvio entre o custo projetado e o realizado medido nas primeiras obras planejadas pelo ITO (meta a definir após as 3 primeiras).
- Todas as planilhas .xlsm históricas migradas para a base.

---

## 2. Usuários

| Perfil | O que faz |
|---|---|
| **Planejamento / orçamento** | Cria projeções, escolhe referências, ajusta premissas, compara cenários e exporta para Excel. |
| **Engenharia de obra** | Consulta obras parecidas, histograma, horas extras e indicadores. |
| **DP / RH** | Faz a carga dos arquivos da folha, classifica funções e rubricas e confere com o ERP. |
| **Controladoria** | Mantém parâmetros, cidades, CCTs e o plano de contas, e confere a apropriação. |
| **Diretoria** | Lê comparações, curvas e custos por m². |

> Perfis e permissões finais: a confirmar (ver PLAN, M0).

---

## 3. Escopo funcional

O menu tem três grupos:
- **Análise:** Base histórica, Comparar obras, Projeções.
- **Dados:** Carga de dados.
- **Configuração:** Cidades e CCTs, Parâmetros, Funções padrão, Rubricas da folha.

Há também uma busca global, aberta com ⌘K.

### 3.1 Base histórica
- Lista de obras com filtro por grupo (Mart Minas, Galpões, Academias…) e busca por nome, cliente ou cidade.
- Indicadores do filtro: nº de obras, duração mediana, pico médio, pessoa-mês por 1.000 m², % de MO indireta e custo de MO por m² a valores vigentes.
- Tabela sem rolagem lateral a partir de 1.280 px, com as colunas:
  - Obra (com cidade e CCT);
  - Área;
  - Período (com nº de dias);
  - mini-histograma (oculto abaixo de 1.340 px);
  - Pico;
  - Pessoa-mês (com PM/1.000 m²);
  - HE por pessoa;
  - Custo na época;
  - Custo a valores vigentes (com R$/m²).
- Ordenação por coluna. Seleção múltipla para **Comparar** ou **Projetar com estas**.

### 3.2 Obra (detalhe) — 10 abas
Todas as abas alternam entre **Época** (tabela da data-base em que a obra foi feita, com trocas no meio da obra) e **Atualizado** (tabela vigente), e entre **competência** e **caixa**.

1. **Visão geral:** histograma por função (pessoas ou custo, barras empilhadas ou agrupadas, eixo em datas ou em mês 1, 2…), composição do custo e dados da obra. Os dados incluem trocas de tabela, feriados e MDO realocada.
2. **Efetivo:** tabela por função e mês, em equivalente (dias) ou cabeças, com subtotais por grupo. Linhas extras:
   - admissões, desligamentos e rotatividade;
   - absenteísmo;
   - licenças e férias (pessoa-dias);
   - efetivo disponível;
   - realocados.

   Clicar numa célula abre a lista de matrículas daquele mês.
3. **Custos:** por função ou por componente, mês a mês. Cada célula mostra o total e "pessoas × custo unitário".
4. **Horas extras:** gasto por função e mês, com custo cheio (adicional, DSR, encargos e provisões). Inclui:
   - a "leitura" em linguagem natural, por exemplo: "em jun/24, 18 pedreiros fizeram 26 h extras cada, a R$ 10,75/h… gastamos R$ 10.171";
   - a tabela de **HE por tipo**.
5. **Folha (rubricas):** valores por rubrica e mês, proventos, descontos e líquido, e a **conferência rubricas × custo do ITO**, com selo "Confere" ou "Diferença". Mostra também o aviso de MDO realocada.
6. **Pessoas:** uma linha por matrícula, **sem nomes**: entrada, saída, meses, HE e custo.
7. **Apropriação:** valores por conta do plano de contas (função → conta; benefícios e exames → contas próprias), confrontados com o realizado no ERP. Diferença por mês com justificativa.
8. **Indicadores:**
   - R$ por dia (com e sem taxa), salário-base, % de encargos e % de benefícios;
   - HE média, efetivo médio, absenteísmo, rotatividade, licenças, férias, adicionais legais e exames por tipo;
   - médias por função.
9. **MDO realocada:** pessoas cedidas a outras obras ou recebidas de outras obras, com período, saldo de VT transferido e custo. O custo fica onde a pessoa trabalhou.
10. **Premissas:**
    - gratificações e prêmios %, transferência %, risco, lucro, tributos s/ lucro, rotatividade e adiantamento %;
    - interruptores: obra fora da sede, provisionar, caixa com adiantamento;
    - regime por função (CLT ou prestador S/P) e transferência por função;
    - distribuição das HE por tipo;
    - trocas de tabela no meio da obra;
    - feriados municipais;
    - ausências por mês (absenteísmo %, licença e férias em pessoa-dias), com dias úteis e DSR do calendário.

### 3.3 Comparar obras
De 2 a 4 obras lado a lado:
- histogramas alinhados por mês relativo;
- indicadores (PM/1.000 m², pico, HE, % indireta, encargos %, benefícios %, R$/dia, custo/m²);
- valores sempre a preços vigentes.

### 3.4 Projeções
- **Lista** de projeções com busca, filtro por situação (Rascunho, Em análise, Aprovada) e seleção para **comparar projeções**.
- **Detalhe**, com navegação ‹ › e um seletor para trocar de projeção. Mostra:
  - indicadores e premissas aplicadas;
  - histograma, efetivo e custo projetados;
  - **"Quanto custa trazer gente de fora"**;
  - curva S;
  - projeção × referências.

  Ações: situação, duplicar, editar e copiar para Excel.
- **Assistente** em 4 passos:
  1. **Obra:** nome, cliente, tipologia, **cidade da obra**, início, área e prazo. Mostra o resumo dos preços da cidade: CCT, salário do oficial, gratificações, VT, ISS e data-base.
  2. **Referências:** obras parecidas com busca, grupo e faixa de área; botão "5 mais parecidas"; média ou mediana. Alternativa: **informar o histograma à mão**.
  3. **Ajustes:**
     - quantidades (manuais ou das referências);
     - ajuste por função (−30% a +30%);
     - HE por pessoa;
     - premissas de custo;
     - regime e transferência por função;
     - **origem da mão de obra por função** (local, vem de outra cidade todo dia, alojada) e a cidade de origem;
     - **reajuste na data-base** (automático pela CCT ou informado);
     - licenças e férias;
     - **HE por tipo**.
  4. **Resultado:** revisar e salvar.

### 3.5 Cidades e CCTs
Duas abas, pensadas para dezenas de CCTs e centenas de cidades.
- **Convenções** (lista + detalhe):
  - **Lista:** busca por nome ou cidade coberta; ordenação por nome, mês da data-base, maior salário ou nº de cidades; paginação de 10; marcar até 4 para **comparar lado a lado**.
  - **Detalhe:**
    - nome e cidades onde vale (com "vincular cidade");
    - data-base (mês) e reajuste estimado;
    - benefícios;
    - **salários e gratificações fixas por função**, comparados com a tabela da empresa e, se escolhida, com outra CCT;
    - ajuste em lote % (salários e gratificações);
    - duplicar e excluir (só sem cidades vinculadas).
- **Cidades** (busca, filtro por CCT, paginação de 15): CCT que vale, tarifa local, conduções, passagem vindo de BH (com o VT diário calculado), ISS e feriados municipais recorrentes.

### 3.6 Carga de dados (assistente em 5 etapas)
1. **Obra:** nome, cliente, tipologia, cidade, área, datas de início e fim, data-base, troca de tabela no meio da obra (mês + nova tabela) e obra fora da sede.
2. **Arquivos:**
   - folha com rubricas (obrigatório);
   - cartão de ponto;
   - VT;
   - NFs de prestadores;
   - realizado do ERP.
3. **Funções:** cada nome da folha vira uma função padrão. O que for mapeado vira sinônimo; dá para criar função nova.
4. **Rubricas:** classificar as rubricas novas (tipo, como entra no custo, base de provisões). Rubrica nova bloqueia a gravação até ser classificada.
5. **Verificação:**
   - proventos × resumo da folha;
   - ponto × folha;
   - funções e rubricas pendentes;
   - VT ausente;
   - NF sem competência;
   - itens lidos da folha;
   - calendário do período;
   - **MDO realocada** (escolher a obra de destino);
   - apropriação × ERP com justificativa.

### 3.7 Parâmetros (tabela da empresa, por data-base)
- Salários por função por data-base.
- Encargos e provisões: itens com base de cálculo e alíquota, CLT e S/P, incidência sobre férias e 13º calculada.
- Benefícios.
- HE, VT e rescisões:
  - adicional de cada tipo de HE e divisor;
  - DSR e dias fixos, só para o modo sem calendário;
  - interruptores "usar calendário real" e "sábado é dia trabalhado";
  - VT e fator de rescisão.
- Adicionais e verbas: salário mínimo, adicional noturno %, salário-família (teto e cota) e o resumo de quem recebe o quê.
- Calendário e feriados:
  - por ano, feriados nacionais e móveis (Sexta-feira Santa; Carnaval e Corpus Christi opcionais);
  - feriados da empresa;
  - tabela de dias de cada mês e DSR.
- Datas-base: data-base vigente e criação de uma nova com reajuste.

### 3.8 Funções padrão
Para cada função:
- grupo (direta, indireta ou administrativa) e conta do plano de contas;
- se escala com a área (proporcional aos m²) ou é fixa por mês;
- exames por tipo (admissional, periódico anual e demissional);
- periculosidade %, insalubridade % do salário mínimo, horas noturnas por mês e ferramentas em R$ por mês;
- vínculo (CLT ou estágio);
- sinônimos na folha.

### 3.9 Rubricas da folha
Dicionário com código, nome, tipo (provento, desconto ou informativo) e como entra no custo. As opções de "como entra" são:
- salário, adicionais, HE, DSR, faltas, rescisão, ferramentas;
- baixa de provisão;
- compensado na GPS;
- não entra (desconto do empregado);
- informativo.

Cada rubrica também diz se é base de provisões.

---

## 4. Requisitos de dados (detalhe exigido pelas planilhas)

O ITO tem de receber e guardar, por competência:
- **Efetivo:** equivalente por dias (fração do mês) e cabeças.
- **Salário:** contratual e base (pró-rata).
- **Adicionais:**
  - gratificações, prêmio e prêmio de produção;
  - periculosidade, insalubridade (sobre o salário mínimo);
  - adicional noturno e DSR noturno;
  - transferência;
  - gratificação fixa da CCT.
- **HE por tipo:** dias úteis, sábado, intervalo intrajornada, domingos e feriados. Mais o DSR sobre HE dividido em ativos, demitidos e ajuste do mês anterior.
- **Faltas:** horas e perda do DSR.
- **Ausências:** dias de licença sem remuneração e dias de férias gozadas.
- **Benefícios:** VT (bruto, desconto de 6% e saldo transferido entre obras), refeição, café, cesta, seguro, alojamento e viagens.
- **Exames:** admissionais, periódicos e demissionais.
- **Rescisões.**
- **Verbas especiais:** depreciação de ferramentas, bolsa estágio, salário-família, arredondamentos, adiantamento e saldo.
- **Realocação:** MDO realocada (cedida ou recebida, com a obra de destino ou de origem).
- **Prestadores S/P:** tributos sobre NF.
- **Apropriação:** realizado do ERP por conta.

---

## 5. Requisitos não funcionais

- **Privacidade:** o histórico guarda só a **matrícula**, nunca o nome do trabalhador.
- **Formato brasileiro** em toda a interface e nas exportações: ponto no milhar e vírgula no decimal (R$ 1.234,56), datas dd/mm/aaaa e meses abreviados (jan/27).
- **Exportação para Excel** (.xlsx) mantém o formato contábil brasileiro.
- **Rastreabilidade:** todo número do custo pode ser aberto até o componente e a fórmula. A conferência com a folha fecha no centavo.
- **Performance:** recálculo de uma projeção em menos de 300 ms; base histórica com 1.000 obras sem travar (paginação ou virtualização, cálculos em cache).
- **Escala da configuração:** listas de CCTs, cidades, funções e rubricas com busca, ordenação e paginação. Nunca uma matriz com uma coluna por cadastro.
- **Design system "Canteiro" (ITO):**
  - grafite e âmbar de sinalização; âmbar = ação, grafite = estado ativo;
  - tipografia Geist e Geist Mono;
  - pills; modo claro e escuro.
- **Responsivo:** layout funcional a partir de 1.180 px no desktop; leitura em tablet.

---

## 6. Fora de escopo (por ora)

- Processar folha de pagamento ou gerar arquivos para eSocial.
- Ponto eletrônico, ou qualquer cadastro com dados pessoais além da matrícula.
- Integração online com o ERP (a carga é por arquivo exportado).
- Cronograma físico da obra (é escopo do WARBRA).

---

## 7. Glossário

| Termo | Significado |
|---|---|
| **Pessoa-mês (PM) / equivalente** | Cada pessoa conta pela fração do mês em que esteve na obra. Quem entrou no dia 16 de um mês de 31 dias conta 0,52. |
| **Cabeças** | Pessoas diferentes que passaram pela folha no mês. |
| **Época × Atualizado** | Custo com a tabela em que a obra foi feita × custo recalculado com a tabela vigente. |
| **Competência × Caixa** | Competência inclui as provisões do mês. Caixa tira as provisões, soma férias pagas e desloca o saldo da folha para o mês seguinte. |
| **Tabela da empresa** | Parâmetros por data-base: encargos, HE, legislação, e salários e benefícios de referência. |
| **CCT** | Convenção coletiva: salários, gratificações, benefícios e data-base válidos nas cidades que ela cobre. |
| **Origem da MO** | Local, vem de outra cidade todo dia (VT intermunicipal) ou alojada (alojamento e viagens, sem VT). |
| **MDO realocada** | Pessoa na folha de uma obra trabalhando em outra. O custo vai para a obra onde ela trabalhou. |
| **S/P** | Prestador sem vínculo: sem encargos de folha, com tributos sobre NF. |
| **% indireta** | Pessoa-mês de indireta e administrativa ÷ pessoa-mês total. |
