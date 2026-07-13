-- 0013: 이수/미이수·성취 기록
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  attendance_ok boolean not null default true,      -- 출석 2/3 충족 여부
  achievement_pct int check (achievement_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (student_id, offering_id)
);

alter table public.achievements enable row level security;

create policy achievements_select on public.achievements
  for select using (student_id = auth.uid() or public.is_staff());
create policy achievements_admin_all on public.achievements
  for all using (public.is_admin()) with check (public.is_admin());

-- 이수 판정 뷰: 공통과목은 출석+성취율40%, 그 외는 출석만
create view public.v_student_credits
with (security_invoker = true) as
select
  e.student_id,
  o.academic_year,
  o.semester,
  o.grade,
  o.credits,
  sub.subject_type,
  sub.name as subject_name,
  a.attendance_ok,
  a.achievement_pct,
  case
    when a.id is null then 'in_progress'
    when a.attendance_ok
      and (sub.subject_type <> '공통' or coalesce(a.achievement_pct, 0) >= 40)
      then 'passed'
    else 'not_met'
  end as result
from public.enrollments e
join public.course_offerings o on o.id = e.offering_id
join public.subjects sub on sub.id = o.subject_id
left join public.achievements a
  on a.student_id = e.student_id and a.offering_id = e.offering_id
where e.status = 'confirmed';

-- 성취 입력 RPC: 담당 교사(해당 개설과목 분반) 또는 관리자만
create or replace function public.set_achievement(
  p_student_id uuid,
  p_offering_id uuid,
  p_attendance_ok boolean,
  p_achievement_pct int
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.sections sec
    where sec.offering_id = p_offering_id and sec.teacher_id = auth.uid()
  ) then
    raise exception '권한이 없습니다.';
  end if;

  insert into public.achievements (student_id, offering_id, attendance_ok, achievement_pct, updated_at)
  values (p_student_id, p_offering_id, p_attendance_ok, p_achievement_pct, now())
  on conflict (student_id, offering_id) do update set
    attendance_ok = excluded.attendance_ok,
    achievement_pct = excluded.achievement_pct,
    updated_at = now();
end $$;

grant execute on function public.set_achievement(uuid, uuid, boolean, int) to authenticated;
