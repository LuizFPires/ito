-- Usuários de desenvolvimento e e2e (só no Supabase local). Senha de todos: ito-dev-2026
-- Não há dados de trabalhadores aqui.
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@ito.local', 'Admin ITO', 'controladoria', true),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'planejamento@ito.local', 'Planejamento', 'planejamento', false),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'engenharia@ito.local', 'Engenharia', 'engenharia', false),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'dprh@ito.local', 'DP RH', 'dp_rh', false),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'diretoria@ito.local', 'Diretoria', 'diretoria', false)
    ) as t(id, email, nome, perfil, admin)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('ito-dev-2026', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'perfil', u.perfil, 'admin', u.admin),
      jsonb_build_object('nome', u.nome), now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now());
  end loop;
end $$;
