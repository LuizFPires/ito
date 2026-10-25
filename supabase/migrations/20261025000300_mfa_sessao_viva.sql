-- M13 · S02 (revisão): o token AAL2 já emitido valia até expirar (até 1 hora) mesmo depois de um
-- admin zerar o segundo fator ou desativar a conta, porque encerrar as sessões só apaga
-- auth.sessions e não invalida o JWT. Para quem precisa de MFA, o AAL2 agora só vale enquanto a
-- sessão do token existir: zerar o MFA, desativar ou sair derrubam o acesso na hora.
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.mfa_obrigatorio(auth.uid())
         or (coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
             and exists (select 1 from auth.sessions s
                         where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
                           and s.user_id = auth.uid()
                           and s.aal = 'aal2'));
$$;
