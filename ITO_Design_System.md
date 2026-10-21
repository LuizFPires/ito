# ITO — Manual da Marca & Design System

**Versão 1.0 · 12/10/2026**  
**Status:** identidade visual aprovada para continuidade da evolução do protótipo.  
**Fonte da verdade:** `ITO_Prototipo_Referencia.html` (cópia integral do protótipo recuperado). Não redesenhar a marca ou substituir seus valores sem aprovação explícita.

## 1. Marca aprovada

- Nome da aplicação: **ITO**.
- Assinatura primária, exatamente como aparece na barra lateral: **`ITO.`**, em caixa alta, com o **ponto final azul-claro**.
- Linha de apoio: **INTELIGÊNCIA EM PROJETOS**.
- Composição: fundo azul-marinho `#142236`, letras brancas `#FFFFFF`, ponto `#7D9EFF`, subtítulo `#8C9BB0`.
- Tipografia implementada: `Montserrat`, fallback `Avenir Next`, tipografia do sistema, Segoe UI, Arial, sans-serif.
- Wordmark no código-fonte: `font-size:37px; font-weight:800; letter-spacing:-2px; line-height:1`.
- Linha de apoio: `font-size:8px; letter-spacing:1.8px; text-transform:uppercase`.
- **Regra inviolável:** não mudar o ponto, a proporção de fonte, a capitalização ou as cores sem revisão do sistema.
- **Precisão:** a marca original é texto estilizado por HTML/CSS; não há no protótipo um arquivo vetorial com letras convertidas em curvas. Por isso `logo_original.html` é a reprodução fiel da implementação, e não um suposto vetor oficial.

## 2. Fundamentos da linguagem visual

A marca e o produto devem transmitir **organização documental, precisão técnica, confiabilidade e agilidade**. Direção de UI: navegação escura e estável, área de trabalho clara, superfícies brancas, azul como sinal de ação e cores semânticas reservadas para estados dos documentos.

### Cores — tokens existentes no HTML

| Token | Valor | Uso |
|---|---|---|
| `--nav` | `#142236` | Barra lateral / base institucional |
| `--ink` | `#172B42` | Texto principal |
| `--muted` | `#708096` | Texto auxiliar |
| `--bg` | `#F5F7FB` | Plano de fundo |
| `--paper` | `#FFFFFF` | Cartões / superfícies |
| `--line` | `#E3E9F0` | Divisórias e bordas |
| `--blue` | `#235DEB` | Botão primário, links e seleção |
| `--blue-light` | `#EDF2FF` | Realces de azul |
| `--green` | `#187653` | Estado liberado |
| `--green-light` | `#E8F5EF` | Fundo liberado |
| `--amber` | `#95610A` | Em análise / atenção |
| `--amber-light` | `#FFF4DC` | Fundo atenção |
| `--red` | `#B04447` | Rejeitada / erro |
| `--red-light` | `#FFF0EF` | Fundo erro |

**Tokens adicionais de identidade:** ponto da marca `#7D9EFF`; texto da assinatura secundária `#8C9BB0`; foco visível `#9DB8FF`.

### Tipografia e hierarquia

- Corpo do sistema: `14px`, altura de linha `1.55`.
- Título de página `h1`: `31px`, peso `720`, tracking `-1.1px`.
- Título de seção `h2`: `18px`.
- Subtítulo `h3`: `15px`.
- Texto pequeno: `12px`; texto técnico em tabelas e códigos: fonte monoespaçada.
- Botões padrão: `12px`, peso `650`. Em ausência de Montserrat instalada, o navegador aplica o fallback; o projeto deve embarcar fonte licenciada para renderização consistente futura.

### Geometria e dimensão

- Raio de painel: `--radius:15px`; bordas de botões `9px`; badges `6px`.
- Sidebar desktop: `224px`, fixa; barra superior: `72px` de altura.
- Painel: branco, borda `1px solid var(--line)`.
- Botões: altura mínima `40px`; versão pequena `32px`; controles de ícone `36px`.
- Ícones: SVG lineares, dimensões padrão `19px`, sem preenchimento, traço `1.7`.
- Sombra-base: `0 12px 38px #1422360c`.

## 3. Componentes existentes e comportamento

| Componente | Papel | Regras |
|---|---|---|
| Barra lateral | Navegação entre módulos e obras | Fundo navy, identidade no topo, estados de seleção claros |
| Cabeçalho | Contexto da tela e controles | Branco translúcido, separação fina |
| Painel/cartão | Agrupamento de dados | Fundo branco, borda suave, raio 15px |
| Botão primário | Ação dominante | Azul `#235DEB`, texto branco; hover `#174ED3` |
| Botão secundário | Ação auxiliar | Branco, borda cinza clara |
| Botão ghost | Ação discreta | Sem preenchimento e sem borda |
| Badge | Situação documental | Verde liberada; âmbar em análise; cinza histórica; vermelho rejeitada |
| Tabelas | Lista de documentos/revisões | Identificação, disciplina, revisão, status, ação |
| Busca e filtros | Localização de projetos | Obras, disciplinas, elementos como P15; limpar filtros quando necessário |
| Alertas | Atenção e informação | Linguagem objetiva e sem confundir aviso com aprovação técnica |

## 4. UX documental — regras que devem ser preservadas

1. Distinguir **revisão recebida**, **revisão em análise**, **revisão liberada** e **histórico obsoleto**.
2. Relacionar revisões ao **mesmo projeto-base**, sem criar documentos soltos para cada R00/R01/R02.
3. Mostrar obra, disciplina, código, título, setor, responsável e revisão de forma identificável.
4. A busca deve aceitar códigos e linguagem de obra (por exemplo, “pilar 15” → “P15”). Atualmente isso é busca local por metadados, **não IA real**.
5. Comparações reais, extração de PDF/DWG/IFC e análises por inteligência artificial exigem backend e processamento que **não fazem parte** do protótipo HTML.
6. Não confundir o status *liberada* de uma demonstração fictícia com liberação técnica para execução real.

## 5. Responsividade e acessibilidade

- Preservar os breakpoints já implementados em `@media (max-width:1200px)` e `@media (max-width:850px)`; abaixo de 850px a sidebar passa a abrir sob demanda.
- Controles com foco visível `3px solid #9DB8FF`, deslocamento `3px`.
- Estados não devem depender apenas da cor: sempre incluir texto da situação.
- Tabelas extensas precisam permanecer navegáveis em telas estreitas.
- Antes da produção: verificar contraste WCAG, navegação por teclado, estados de carregamento, vazio e erro.

## 6. Regras de governança

- O **HTML recuperado** é a referência canônica da identidade aprovada em 12/10/2026.
- `tokens.css` e `tokens.json` documentam os valores CSS originais e devem alimentar novas telas.
- `logo_original.html` preserva a composição exata de HTML/CSS da assinatura no protótipo.
- Evitar trocar tipografia, alterar navy/azul, usar gradients decorativos ou dar destaque igual a todas as ações.
- Futuras modificações visuais devem gerar nova versão do manual e changelog.

## 7. Próximas etapas sugeridas

- Revisão funcional do protótipo pelo proprietário do produto.
- Catálogo completo de componentes reutilizáveis em React, com estados e responsividade.
- Construção da autenticação, permissões, armazenamento e conectores, mantendo os tokens.
- Validação da busca inteligente e extração de elementos gráficos em projetos reais com rastreabilidade de fontes.

## Arquivos deste pacote

- `ITO_Design_System.md`: esta documentação.
- `tokens.css`: tokens diretamente extraídos do protótipo.
- `tokens.json`: mesmos tokens em formato interoperável.
- `logo_original.html`: reprodução da marca original sem redesenho.
- `ITO_Prototipo_Referencia.html`: fonte de referência integral, inalterada.
