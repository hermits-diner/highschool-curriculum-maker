-- 0005: 수강신청/취소 RPC (동시성 처리의 권위 레이어)
-- 정원·중복·기간·위계·택1 검증은 이 함수 안에서만 신뢰한다.

create or replace function public.enroll_course(
  p_round_id uuid,
  p_offering_id uuid,
  p_priority int default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_round record;
  v_offering record;
  v_grade int;
  v_now timestamptz := now();
  v_confirmed int;
  v_existing record;
begin
  select grade into v_grade from public.students where id = v_student;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '학생 계정만 신청할 수 있습니다.');
  end if;

  select * into v_round from public.enrollment_rounds where id = p_round_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '신청 기간을 찾을 수 없습니다.');
  end if;
  if v_now < v_round.opens_at or v_now > v_round.closes_at then
    return jsonb_build_object('ok', false, 'reason', '신청 기간이 아닙니다.');
  end if;
  if v_grade is distinct from v_round.target_grade then
    return jsonb_build_object('ok', false, 'reason', '신청 대상 학년이 아닙니다.');
  end if;

  -- 개설과목 행 잠금 (과목 단위 직렬화)
  select * into v_offering from public.course_offerings
    where id = p_offering_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '개설과목을 찾을 수 없습니다.');
  end if;
  if v_offering.academic_year <> v_round.academic_year
     or v_offering.semester <> v_round.semester
     or v_offering.grade <> v_round.target_grade then
    return jsonb_build_object('ok', false, 'reason', '해당 신청 기간에 신청할 수 없는 과목입니다.');
  end if;
  if v_offering.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', '폐강된 과목입니다.');
  end if;

  -- 택1 그룹 내 중복 신청 차단
  if v_offering.choice_group is not null then
    if exists (
      select 1 from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id
      where e.round_id = p_round_id and e.student_id = v_student
        and e.status in ('requested', 'confirmed', 'waitlisted')
        and o.choice_group = v_offering.choice_group
        and o.id <> p_offering_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'reason', format('「%s」 그룹에서는 한 과목만 신청할 수 있습니다.', v_offering.choice_group)
      );
    end if;
  end if;

  -- 선수과목(필수) 위계 검증 — 정식신청/정정에만 적용
  if v_round.round_type <> 'survey' then
    if exists (
      select 1 from public.prerequisite_rules pr
      where pr.subject_id = v_offering.subject_id
        and pr.enforcement = 'required'
        and not exists (
          select 1 from public.enrollments e2
          join public.course_offerings o2 on o2.id = e2.offering_id
          where e2.student_id = v_student and e2.status = 'confirmed'
            and o2.subject_id = pr.prerequisite_subject_id
        )
        and not exists (
          select 1 from public.curriculum_entries ce
          join public.curriculum_plans cp on cp.id = ce.plan_id
          join public.students st on st.id = v_student
            and cp.admission_year = st.admission_year
          where ce.subject_id = pr.prerequisite_subject_id and ce.is_required
        )
    ) then
      return jsonb_build_object('ok', false, 'reason', '선수과목을 아직 이수하지 않았습니다.');
    end if;
  end if;

  select * into v_existing from public.enrollments
    where round_id = p_round_id and student_id = v_student and offering_id = p_offering_id;

  if v_round.round_type = 'survey' then
    if v_existing.id is not null then
      update public.enrollments
        set status = 'requested', priority = p_priority, updated_at = v_now
        where id = v_existing.id;
    else
      insert into public.enrollments (round_id, student_id, offering_id, status, priority)
      values (p_round_id, v_student, p_offering_id, 'requested', p_priority);
    end if;
    return jsonb_build_object('ok', true, 'status', 'requested');
  end if;

  -- 정식신청/정정: 정원 판정
  select count(*) into v_confirmed from public.enrollments
    where offering_id = p_offering_id and status = 'confirmed';

  if v_confirmed < v_offering.capacity then
    if v_existing.id is not null then
      update public.enrollments
        set status = 'confirmed', priority = p_priority, updated_at = v_now
        where id = v_existing.id;
    else
      insert into public.enrollments (round_id, student_id, offering_id, status, priority)
      values (p_round_id, v_student, p_offering_id, 'confirmed', p_priority);
    end if;
    return jsonb_build_object('ok', true, 'status', 'confirmed');
  else
    if v_existing.id is not null then
      update public.enrollments
        set status = 'waitlisted', priority = p_priority, updated_at = v_now
        where id = v_existing.id;
    else
      insert into public.enrollments (round_id, student_id, offering_id, status, priority)
      values (p_round_id, v_student, p_offering_id, 'waitlisted', p_priority);
    end if;
    return jsonb_build_object('ok', true, 'status', 'waitlisted');
  end if;
end $$;

create or replace function public.cancel_enrollment(
  p_round_id uuid,
  p_offering_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_round record;
  v_enr record;
  v_promote uuid;
  v_now timestamptz := now();
begin
  select * into v_round from public.enrollment_rounds where id = p_round_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '신청 기간을 찾을 수 없습니다.');
  end if;
  if v_now < v_round.opens_at or v_now > v_round.closes_at then
    return jsonb_build_object('ok', false, 'reason', '신청 변경 기간이 아닙니다.');
  end if;

  -- 개설과목 잠금 (승격과 직렬화)
  perform 1 from public.course_offerings where id = p_offering_id for update;

  select * into v_enr from public.enrollments
    where round_id = p_round_id and student_id = v_student and offering_id = p_offering_id;
  if not found or v_enr.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', '취소할 신청 내역이 없습니다.');
  end if;

  update public.enrollments set status = 'cancelled', updated_at = v_now where id = v_enr.id;

  -- 확정 자리가 비면 대기 1순위 승격
  if v_enr.status = 'confirmed' then
    select id into v_promote from public.enrollments
      where offering_id = p_offering_id and status = 'waitlisted'
      order by created_at asc limit 1;
    if v_promote is not null then
      update public.enrollments set status = 'confirmed', updated_at = v_now where id = v_promote;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.enroll_course(uuid, uuid, int) to authenticated;
grant execute on function public.cancel_enrollment(uuid, uuid) to authenticated;
