# Operação do ITO

Como publicar, gerir usuários, fazer backup, restaurar e acompanhar o ITO. Ambientes, chaves e variáveis estão em [AMBIENTES.md](AMBIENTES.md).

## 1. Publicar uma versão

A ordem é sempre esta: homologação primeiro, produção só depois de validar.

1. **Banco:** aplique as migrações novas.
   ```sh
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
2. **Edge Functions** (gestão de usuários, M10). A função usa as variáveis `SUPABASE_*` que o próprio Supabase injeta, então não precisa de segredo extra.
   ```sh
   pnpm exec supabase functions deploy usuarios --project-ref <ref>
   ```
3. **Auth:** aplique a configuração. O comando leva o modelo do e-mail de convite em português (`supabase/templates/convite.html`).
   ```sh
   pnpm exec supabase config diff --project-ref <ref>
   pnpm exec supabase config push --project-ref <ref>
   ```
   Se o push não levar o modelo, cole o mesmo HTML em Authentication → Email Templates → Invite user, com o assunto "Convite para o ITO".
4. **Front:** o merge na `main` publica a produção na Vercel. Cada PR gera um preview ligado à homologação.
5. **Confira** depois de cada publicação:
   - entrar com um usuário de cada perfil;
   - abrir a base histórica e uma obra;
   - recalcular uma projeção;
   - abrir a Auditoria e ver a alteração que acabou de fazer.

## 2. Usuários

A gestão é pela tela **Administração → Usuários**, só para quem é admin.

- **Convidar:** informe e-mail, nome, perfil e, se for o caso, admin.
  - A pessoa recebe o e-mail "Convite para o ITO" e define a senha (mínimo de 10 caracteres) em `/definir-senha`.
  - Convidar de novo quem ainda não entrou reenvia o convite.
- **Perfil e admin:** mudam na própria lista e valem na hora.
  - O admin não tira o próprio acesso de admin.
  - O ITO nunca fica sem pelo menos um admin ativo.
- **Desativar:** bloqueia o login e encerra as sessões abertas. A pessoa perde a leitura e a escrita na hora.
  - Nada é apagado: o que ela gravou continua com a autoria dela.
  - **Reativar** devolve o acesso.
- **Permissões:** a tabela "Permissões por perfil", na mesma tela, sai das regras do banco. Um teste de banco (`permissoes.test.sql`) falha se ela divergir do que as funções e a RLS deixam fazer.
- **Homologação:** o link do convite aponta para o domínio de produção, porque o preview não tem URL fixa (veja AMBIENTES.md).
  - Em homologação, crie as pessoas pelo painel: Authentication → Users → Add user, com senha e "Auto Confirm".
  - Perfil, admin e desativação funcionam pela tela normalmente.
- **Primeiro admin de um projeto novo:** convide-o pelo painel e rode no SQL Editor:
  `update public.usuarios set admin = true, perfil = 'controladoria' where email = '<e-mail>';`

## 3. Backup

São duas linhas de defesa:

1. **Backups do Supabase:** cópias diárias automáticas, feitas pelo próprio Supabase. A retenção depende do plano; no plano Pro são 7 dias. Com o add-on PITR, a restauração vale para qualquer minuto do período.
   - Confira em Database → Backups de cada projeto.
   - Em produção, contrate pelo menos o plano Pro.
2. **`pnpm db:backup`:** cópia sob o nosso controle, com esquema e dados (`public` e `auth`), gravada numa pasta fora do repositório.
   ```sh
   pnpm db:backup producao                         # ~/ITO-backups/producao-<data>
   pnpm db:backup homologacao --pasta D:\backups\ito
   ```
   - Precisa da senha do banco em `.env.supabase.local` (`SUPABASE_DB_PASSWORD_PRODUCAO` ou `_HOMOLOGACAO`). A senha vai para o CLI por variável de ambiente, nunca na linha de comando.
   - O dump traz valores por matrícula, sem nomes. Guarde-o em pasta com acesso restrito (cofre ou unidade da controladoria), nunca no git nem em e-mail.
   - **Rotina sugerida:** semanal em produção e antes de cada migração que mexa em dados. Guarde as 8 últimas cópias.

## 4. Restauração

**Ensaio ou conferência no ambiente local:**

```sh
pnpm db:restaurar <pasta do backup>
```

O comando:

- recria o banco local pelas migrações;
- esvazia o que o seed pôs;
- carrega os dados com os gatilhos desligados, para a restauração não aparecer na auditoria;
- mostra as contagens.

O ensaio de 22/10/2026 restaurou as 23 obras migradas (3.172 lançamentos, 5 usuários, 7.148 linhas de auditoria) com as mesmas contagens do banco de origem, e o login voltou a funcionar.

**Homologação ou produção:**

1. **Perda recente**, como um erro de operação ou uma carga errada: restaure pelo Supabase, em Database → Backups (ou PITR), para o ponto anterior ao problema. É o caminho mais seguro, porque restaura o projeto inteiro: auth, banco e configuração.
2. **Projeto perdido ou cópia em outro lugar:** crie um projeto novo e aplique as migrações (`db push`). Depois carregue o `dados.sql` do backup com `psql`, como faz `scripts/restaurar.mjs`:
   - esvazie `public` e `auth`;
   - rode `set session_replication_role = replica` e carregue os dados;
   - volte para `origin`.

   Em seguida, publique a Edge Function e a configuração (seção 1) e confira as contagens.
3. **Depois de qualquer restauração:**
   - confira a Auditoria, que mostra até onde os dados voltaram;
   - avise quem gravou algo depois do ponto restaurado;
   - abra a base histórica uma vez como admin, para os resumos das obras serem recalculados se a tabela vigente mudou.

## 5. Auditoria

**Administração → Auditoria** mostra o que mudou, com a versão anterior e a nova, quem mudou e quando, com filtros por módulo, pessoa e período. A tela é para admin, controladoria e diretoria; a auditoria de usuários, só para o admin.

- O detalhe da obra, da projeção, da data-base e da CCT tem um "Histórico de alterações" com os registros daquele item.
- Ninguém edita nem apaga a auditoria, e ela é guardada para sempre.
- A carga e a exclusão de uma obra registram só a obra, não cada lançamento por matrícula.

## 6. Desempenho

As metas do PRD §5 são verificadas com volume sintético, só no banco local:

```sh
pnpm desempenho gerar      # 1.000 obras, 100 CCTs, 500 cidades (prefixo perf_)
ITO_DESEMPENHO=1 pnpm exec playwright test e2e/m10-desempenho.spec.ts --workers=1
pnpm desempenho limpar
```

Medido em 22/10/2026, com 1.000 obras:

| Medição | Tempo | Meta |
|---|---|---|
| Base: abrir | 1,1 s | 4 s |
| Base: filtrar | 0,1 s | 1 s |
| Base: paginar | 0,3 s | 1 s |
| Detalhe da obra | 1,1 s | 3 s |
| 100 CCTs | 1,3 s | 3 s |
| 500 cidades | 0,1 s | 2 s |
| Projeção de 36 meses (5 referências, 20 funções) | 53 ms | 300 ms |

## 7. Incidentes

- **Acesso indevido ou pessoa que saiu da empresa:** desative a pessoa na tela de usuários. O efeito é imediato: a sessão é encerrada e a leitura negada.
- **Chave vazada:**
  - **Publicável:** baixo risco, porque a RLS protege os dados. Mesmo assim, gire a chave no painel (Settings → API Keys) e atualize a Vercel.
  - **Secret / service role:** gire já no painel. Ela fica só nas Edge Functions, injetada pelo Supabase, e nunca no front.
- **Carga errada:** quem carrega grava a obra de novo pela tela de carga, com o mesmo código; a tela pede para confirmar a substituição. A auditoria mostra quem carregou e quando.
- **Dúvida sobre um número:** o detalhe da obra abre cada componente até a fórmula (SPEC). A conferência da folha fecha no centavo.
