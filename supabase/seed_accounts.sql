-- 최초 관리자 계정 시드 (재실행 안전)
-- 이메일: admin@school.test / 초기 비밀번호: admin1234!  (로그인 후 변경 권장)
-- 주의: 운영 배포 시 비밀번호를 즉시 변경하세요.

do $$
declare uid uuid;
begin
  if not exists (select 1 from auth.users where email = 'admin@school.test') then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'admin@school.test',
      extensions.crypt('admin1234!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'admin@school.test', 'email_verified', true),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, role, name, must_change_password)
      values (uid, 'admin', '관리자', true);
  end if;
end $$;
