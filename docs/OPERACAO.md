# Operação do ITO

Como publicar, gerir usuários, fazer backup, restaurar e acompanhar o ITO. Ambientes, chaves e variáveis estão em [AMBIENTES.md](AMBIENTES.md).

## 1. Publicar uma versão

A ordem é sempre esta: homologação primeiro, produção só depois de validar.

1. **Banco:** aplique as migrações novas.
   ```sh
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
2. **Edge Functions** (gestão de usuários, M10). A função usa as variáveis `SUPABASE_*` que o próprio Supabase injeta e, desde o M13, o endereço do site em `ITO_SITE_URL`. É para lá que os links de convite e de senha voltam; o cabeçalho de quem chama não é usado. Sem `ITO_SITE_URL`, a função recusa as chamadas fora do Supabase local.
   ```sh
   pnpm exec supabase secrets set ITO_SITE_URL=https://<endereço do site> --project-ref <ref>
   pnpm exec supabase functions deploy usuarios --project-ref <ref>
   pnpm exec supabase functions deploy projecoes --project-ref <ref>
   ```
   Na homologação, que atende os previews da Vercel, libere também o CORS deles: `supabase secrets set ITO_PREVIEWS=sim --project-ref <homologação>` (na produção, não).

   **Ordem quando a versão muda a aprovação ou o cálculo:** 1) publique as funções (`projecoes` com o `calculo.gerado.js` novo); 2) aplique as migrações; 3) faça o merge, que publica o site. Ao contrário, alguém pode tentar aprovar com uma função velha (recusada pelo banco) ou com o cálculo antigo.

   A função `projecoes` (M14) aprova as projeções refazendo o cálculo no servidor, com o mesmo código da tela (`supabase/functions/projecoes/calculo.gerado.js`, gerado por `pnpm gen:calculo` e conferido no CI). Publique-a junto com as migrações que mexem no cálculo ou nas tabelas que ele lê.
3. **Auth:** aplique a configuração. O comando leva os modelos de e-mail em português: convite (`supabase/templates/convite.html`) e troca de senha (`recuperar.html`).
   ```sh
   pnpm exec supabase config diff --project-ref <ref>
   pnpm exec supabase config push --project-ref <ref>
   ```
   Se o push não levar os modelos, cole o HTML em Authentication → Email Templates: "Invite user" com o assunto "Convite para o ITO" e "Reset password" com "Definir senha do ITO".
   - **E-mail de verdade (SMTP), obrigatório em produção:** o envio padrão do Supabase manda pouquíssimos e-mails por hora e só para a equipe do projeto, e o convite pela tela falha com "O convite não foi enviado". Configure um SMTP próprio (o da empresa ou um serviço como Resend, SendGrid, Amazon SES) em Authentication → SMTP Settings, com o remetente do domínio da Clássica, antes do primeiro convite.
   - **Primeira publicação da Edge Function:** confira que convidar, desativar e reativar funcionam. Se o projeto tiver desligado as chaves antigas (JWT), a função pode não receber `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`; nesse caso, guarde a chave secreta como segredo da função (`supabase secrets set`) e ajuste a leitura em `supabase/functions/usuarios/index.ts`.
4. **Front:** o merge na `main` publica a produção na Vercel. Cada PR gera um preview ligado à homologação. A `main` é protegida (M14): só recebe merge de PR com o CI verde e em dia, sem force push.
   - **Voltar uma publicação do site:** na Vercel, em Deployments, escolha a publicação anterior e use "Instant Rollback" (volta em segundos, sem build). Se a versão nova veio com migração, confira se a anterior funciona com o banco novo antes de voltar; migração não se desfaz por aqui (crie outra que corrija).
5. **Confira** depois de cada publicação:
   - `pnpm db:reset` e depois `pnpm db:conferir homologacao` e `pnpm db:conferir producao`: o catálogo remoto (tabelas, RLS, políticas, funções, grants, gatilhos, restrições, migrações) tem de ser o que as migrações dão. Divergência = migração não aplicada ou mudança feita à mão no painel (refaça como migração). Só lê; mostra nomes de objetos, nunca dados;
   - entrar com um usuário de cada perfil;
   - abrir a base histórica e uma obra;
   - recalcular uma projeção;
   - abrir a Auditoria e ver a alteração que acabou de fazer.

## 2. Usuários

A gestão é pela tela **Administração → Usuários**, só para quem é admin.

- **Convidar:** informe e-mail, nome, perfil e, se for o caso, admin.
  - A pessoa recebe o e-mail "Convite para o ITO" e define a senha (mínimo de 10 caracteres) em `/definir-senha`.
  - O link vale por 1 hora. Se expirar, ou se a pessoa abriu o link e não salvou a senha, use **Enviar link de senha** na linha dela: manda o convite de novo ou, para quem já tem senha, o e-mail de troca de senha.
  - Quem esqueceu a senha usa **Esqueci a senha** na tela de entrada.
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
   pnpm db:backup producao --cifrar                # ~/ITO-backups/producao-<data>
   pnpm db:backup homologacao --pasta D:\backups\ito --cifrar
   ```
   - Precisa da senha do banco em `.env.supabase.local` (`SUPABASE_DB_PASSWORD_PRODUCAO` ou `_HOMOLOGACAO`). A senha vai para o CLI por variável de ambiente, nunca na linha de comando.
   - **Use `--cifrar` (M13):** esquema e dados saem cifrados (AES-256-GCM, arquivos `.cifrado`) com a frase de `ITO_BACKUP_CHAVE` (no ambiente ou em `.env.supabase.local`, ao menos 16 caracteres). A frase fica no cofre de senhas da empresa, **nunca na pasta do backup** nem junto da cópia: sem ela o backup não abre, e um arquivo alterado também não abre.
   - O dump traz contas (com o hash da senha) e valores por matrícula, sem nomes. Ficam de fora os segredos do Auth: sessões, tokens, fatores e desafios de MFA, códigos de uso único e logs. Depois de restaurar, cada pessoa entra de novo e quem precisa de MFA se inscreve outra vez. Mesmo cifrado, guarde em local com acesso restrito, nunca no git nem em e-mail.
   - O script cria a pasta só para o dono: no Linux e no Mac, com chmod 700; no Windows, tirando a herança de permissões e deixando só o próprio usuário (icacls). Ele confere a permissão e para se outra conta tiver acesso.
   - **Rotina sugerida:** semanal em produção e antes de cada migração que mexa em dados. Guarde as 8 últimas cópias.

**Metas de recuperação (M14, conferido em 25/10/2026):** backups diários do Supabase presentes nos dois projetos (`supabase backups list`), PITR desligado.
- **RPO (quanto se pode perder): até 24 horas** com o backup diário; até 7 dias de cópia com o `db:backup` semanal. Para chegar a minutos, contrate o add-on PITR (decisão de custo do usuário).
- **RTO (quanto tempo para voltar): até 1 hora** pelo painel (Database → Backups → Restore, banco de poucas centenas de MB) e até 4 horas num projeto novo com o `db:backup` (seção 4).
- Ensaie a restauração a cada 3 meses: `pnpm db:backup producao --cifrar` e `pnpm db:restaurar` no local, conferindo as contagens.

## 4. Restauração

**Ensaio ou conferência no ambiente local:**

```sh
pnpm db:restaurar <pasta do backup> --confirmar
# backup cifrado: a frase vem de ITO_BACKUP_CHAVE (frase errada = o comando para sem mexer no banco)
```

O comando:

- recria o banco local pelas migrações;
- esvazia o que o seed pôs;
- carrega os dados com os gatilhos desligados, para a restauração não aparecer na auditoria;
- mostra as contagens.

O ensaio de 22/10/2026 restaurou as 23 obras migradas (3.172 lançamentos, 5 usuários, 7.148 linhas de auditoria) com as mesmas contagens do banco de origem, e o login voltou a funcionar.

**Homologação ou produção:**

1. **Perda recente**, como um erro de operação ou uma carga errada: restaure pelo Supabase, em Database → Backups (ou PITR), para o ponto anterior ao problema. É o caminho mais seguro, porque restaura o projeto inteiro: auth, banco e configuração.
2. **Projeto perdido ou cópia em outro lugar:** crie um projeto novo e aplique as migrações (`db push`). Depois carregue o `dados.sql` do backup com `psql`, como faz `scripts/restaurar.mjs` (cifrado: abra-o antes com `decifrarArquivo`, de `scripts/cifra.mjs`):
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

- O detalhe da obra, da projeção e da CCT tem um "Histórico de alterações" daquele item; em Parâmetros, o histórico é de toda a tabela da empresa (data-bases, HE, adicionais, calendário).
- Convidar, desativar e reativar ficam com o admin que fez. A criação da conta pelo Auth aparece sem autor, seguida da linha do admin que convidou.
- Regravar o resumo de uma projeção (feito ao abrir, quando os preços mudaram) não aparece como alteração.
- Ninguém edita nem apaga a auditoria, e ela é guardada para sempre.
- A carga e a exclusão de uma obra registram a obra e os cadastros que a carga mudar (sinônimos de função, rubricas novas), não as linhas por mês nem cada lançamento por matrícula.
- Quem lê a auditoria (controladoria e diretoria) vê o e-mail de quem alterou, mesmo sem acesso à lista de usuários: é o que dá sentido à trilha.

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

**Proteções ligadas (M14):** SSL obrigatório nas conexões diretas ao banco; no GitHub, varredura de segredos com bloqueio no push, alertas e correções de segurança do Dependabot e Actions fixadas por SHA (o Dependabot abre PR mensal para atualizá-las). Ficam com o dono das contas: MFA no GitHub, na Vercel e no Supabase, e restrição de rede do banco (só se as migrações passarem a sair de um IP fixo).


- **Acesso indevido ou pessoa que saiu da empresa:** desative a pessoa na tela de usuários. O efeito é imediato: a sessão é encerrada e a leitura negada.
- **Chave vazada:**
  - **Publicável:** baixo risco, porque a RLS protege os dados. Mesmo assim, gire a chave no painel (Settings → API Keys) e atualize a Vercel.
  - **Secret / service role:** gire já no painel. Ela fica só nas Edge Functions, injetada pelo Supabase, e nunca no front.
- **Carga errada:** quem carrega grava a obra de novo pela tela de carga, com o mesmo código; a tela pede para confirmar a substituição. A auditoria mostra quem carregou e quando.
- **Dúvida sobre um número:** o detalhe da obra abre cada componente até a fórmula (SPEC). A conferência da folha fecha no centavo.
