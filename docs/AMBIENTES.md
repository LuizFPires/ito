# Ambientes do ITO

Publicação, usuários, backup e restauração: [OPERACAO.md](OPERACAO.md).

| Ambiente | Banco e Auth | Front | Quem usa |
|---|---|---|---|
| Desenvolvimento | Supabase local (`pnpm db:start`, portas 548xx) | `pnpm dev` (localhost:5173) | equipe de desenvolvimento, CI |
| Homologação | Supabase `ito-homologacao` (ref `rtciuljdjdvocxitaepz`, sa-east-1) | Vercel **Preview** (cada PR) | validação com a Clássica |
| Produção | Supabase `ito-producao` (ref `pntkdmzbuqvhypebbhhn`, sa-east-1) | Vercel **Production** (branch `main`): https://ito-three-beryl.vercel.app | usuários |

As senhas do banco dos projetos remotos ficam em `.env.supabase.local` (fora do git) na máquina de quem criou os projetos. Guarde-as também no cofre de senhas da empresa.

## Migrações

Toda mudança de banco é uma migração nova em `supabase/migrations` e passa primeiro pelo local e pelo CI. Depois:

```sh
# homologação
pnpm exec supabase link --project-ref rtciuljdjdvocxitaepz
pnpm exec supabase db push

# produção (só depois de validar em homologação)
pnpm exec supabase link --project-ref pntkdmzbuqvhypebbhhn
pnpm exec supabase db push
pnpm exec supabase unlink
```

O `seed.sql` (usuários `*@ito.local`) **não** vai para homologação nem produção.

## Auth nos projetos remotos

Declarado em `supabase/config.toml` (`[remotes.homologacao]` e `[remotes.producao]`). Confira com `pnpm exec supabase config diff --project-ref <ref>` e aplique com `pnpm exec supabase config push --project-ref <ref>`. Os blocos `remotes` repetem alguns valores do remoto (confirmação de e-mail, MFA, pooler, storage) para o push não trocá-los pelos do ambiente local. Aplicado em 21/10/2026:

- **Sign up**: desligado (acesso por convite).
- **Senha mínima**: 10 caracteres.
- **Site URL**: `https://ito-three-beryl.vercel.app` nos dois. **Redirect URLs**: em produção, só o domínio de produção; em homologação, nenhuma.
  Não use curinga do tipo `https://ito-*-luiz-fp-ires.vercel.app/**`: qualquer pessoa pode criar na Vercel um projeto cujo domínio case com o padrão e receber tokens de convite ou de recuperação de senha. Como o preview não tem URL fixa, em homologação crie os usuários pelo painel (Authentication → Users → Add user → com senha e "Auto Confirm"), sem link por e-mail. Se um dia precisar de link em homologação, use um domínio próprio para os previews e libere só ele.
- Primeiro admin: convidar pelo painel (Authentication → Users → Invite) e, depois que a conta existir, rodar no SQL Editor:
  `update public.usuarios set admin = true, perfil = 'controladoria' where email = '<e-mail>';`
  Atenção: o perfil é lido do `app_metadata` **só na criação** da conta. Mudar o `app_metadata` depois não altera `public.usuarios`; para trocar perfil ou admin, altere `public.usuarios` (pelo SQL Editor ou, mais tarde, pela tela de usuários).

## Vercel

Projeto `ito`, ligado a `github.com/LuizFPires/ito`, **Root Directory = `apps/web`** (a configuração está em `apps/web/vercel.json`).

| Variável | Production | Preview |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://pntkdmzbuqvhypebbhhn.supabase.co` | `https://rtciuljdjdvocxitaepz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publicável de `ito-producao` | chave publicável de `ito-homologacao` |
| `VITE_AMBIENTE` | `producao` | `homologacao` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | `1` |

`ENABLE_EXPERIMENTAL_COREPACK=1` faz a Vercel usar o pnpm do campo `packageManager` (11.x); sem ele, ela escolhe pela versão do lockfile.

A chave publicável sai de `pnpm exec supabase projects api-keys --project-ref <ref>` (linha `publishable`). Nunca coloque a secret/service role no front.

## Estado da homologação (22/10/2026)

- Migrações do M1 ao M9 aplicadas em `ito-homologacao` **antes do merge** dos PRs #2 a #9 (autorizado pelo usuário, para carregar o histórico). Ao fazer os merges, o `db push` não terá o que aplicar até a próxima migração nova.
- Histórico migrado (M9): 23 obras, 716 pessoas, 3.172 lançamentos, 2.640,4 pessoa-mês, com `pnpm migrar carregar <pasta> --url https://rtciuljdjdvocxitaepz.supabase.co --chave <publicável>` e o usuário `migracao@ito-homologacao.local` (controladoria + admin), **bloqueado** depois da carga (senha em `.env.supabase.local`). Para rodar de novo (áreas reais, revisão de funções e rubricas), desbloqueie pelo painel (Authentication → Users) e bloqueie ao terminar. Carga refeita em 21/10/2026 com as correções da revisão do M9 (totais da planilha fora das rubricas, 13º e faltas DSR nas rubricas certas); mesmos totais de efetivo.
- Área provisória de 10.000 m² em todas as obras (ver `docs/migracao/obras.csv`).
