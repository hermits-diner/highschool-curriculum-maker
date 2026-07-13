-- 0009: 학생이 담당 교사 이름을 볼 수 있도록 (본인 + 모든 교직원 프로필 조회 허용)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.is_staff()
    or role in ('teacher', 'admin')
  );
