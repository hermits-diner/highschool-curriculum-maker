-- 0002: 비밀번호 변경 완료 표시 RPC
-- 학생/교사는 profiles UPDATE 권한이 없으므로 security definer 함수로 본인 행만 갱신

create or replace function public.mark_password_changed()
returns void
language sql volatile security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid()
$$;
