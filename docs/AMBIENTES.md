# Ambientes do ITO

| Ambiente | Banco e Auth | Front | Quem usa |
|---|---|---|---|
| Desenvolvimento | Supabase local (`pnpm db:start`, portas 548xx) | `pnpm dev` (localhost:5173) | equipe de desenvolvimento, CI |
| Homologação | Supabase `ito-homologacao` (ref `rtciuljdjdvocxitaepz`, sa-east-1) | Vercel **Preview** (cada PR) | validação com a Clássica |
| Produção | Supabase `ito-producao` (ref `pntkdmzbuqvhypebbhhn`, sa-east-1) | Vercel **Production** (branch `main`) | usuários |

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

## Auth nos projetos remotos (painel do Supabase → Authentication)

- **Sign up**: desligado (acesso por convite).
- **Senha mínima**: 10 caracteres.
- **Site URL**: a URL da Vercel do ambiente; em **Redirect URLs**, inclua as URLs de Preview (`https://ito-*-luizfpires.vercel.app/**`) no projeto de homologação.
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
