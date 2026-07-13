-- 0012: 미완료 학생 집계 + 대기자 자동 승격

-- 라운드에서 '택1 그룹마다 1과목' 선택을 완료하지 못한 학생 수
create or replace function public.round_incomplete_count(p_round_id uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  with r as (select * from public.enrollment_rounds where id = p_round_id),
  grp as (
    select distinct o.choice_group
    from public.course_offerings o, r
    where o.academic_year = r.academic_year and o.semester = r.semester
      and o.grade = r.target_grade and o.is_required = false
      and o.choice_group is not null and o.status <> 'cancelled'
  ),
  total as (select count(*) as g from grp),
  studs as (
    select s.id from public.students s, r
    where s.grade = r.target_grade and s.status = '재학'
  ),
  picked as (
    select e.student_id, count(distinct o.choice_group) as g
    from public.enrollments e
    join public.course_offerings o on o.id = e.offering_id
    where e.round_id = p_round_id
      and e.status in ('requested','confirmed','waitlisted')
      and o.choice_group is not null
    group by e.student_id
  )
  select greatest(
    (select count(*) from studs)
    - (select count(*) from picked p, total t where p.g >= t.g and t.g > 0),
    0
  )::int;
$$;

grant execute on function public.round_incomplete_count(uuid) to authenticated;

-- 정원 여유만큼 대기자를 신청순으로 확정 승격
create or replace function public.promote_waitlist(p_offering_id uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_cap int;
  v_confirmed int;
  v_slots int;
  v_promoted int := 0;
  rec record;
begin
  select capacity into v_cap from public.course_offerings
    where id = p_offering_id for update;
  if not found then return 0; end if;

  select count(*) into v_confirmed from public.enrollments
    where offering_id = p_offering_id and status = 'confirmed';

  v_slots := v_cap - v_confirmed;
  if v_slots <= 0 then return 0; end if;

  for rec in
    select id from public.enrollments
    where offering_id = p_offering_id and status = 'waitlisted'
    order by created_at asc
    limit v_slots
  loop
    update public.enrollments set status = 'confirmed', updated_at = now()
      where id = rec.id;
    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end $$;

grant execute on function public.promote_waitlist(uuid) to authenticated;
