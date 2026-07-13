-- 0011: enroll_course v2 — max_choices·학기학점 상한·실제 이수기반 위계 검증
-- (0005의 enroll_course를 대체)
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
  v_admission int;
  v_now timestamptz := now();
  v_confirmed int;
  v_existing record;
  v_active_choices int;
  v_sem_credits int;
  v_max_credits int;
begin
  select grade, admission_year into v_grade, v_admission
    from public.students where id = v_student;
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

  select * into v_existing from public.enrollments
    where round_id = p_round_id and student_id = v_student and offering_id = p_offering_id;

  if v_existing.id is null or v_existing.status = 'cancelled' then
    if v_round.max_choices is not null then
      select count(*) into v_active_choices from public.enrollments
        where round_id = p_round_id and student_id = v_student
          and status in ('requested','confirmed','waitlisted');
      if v_active_choices >= v_round.max_choices then
        return jsonb_build_object('ok', false,
          'reason', format('최대 %s과목까지 신청할 수 있습니다.', v_round.max_choices));
      end if;
    end if;

    select max_credits_per_semester into v_max_credits from public.school_settings where id = 1;
    if v_max_credits is not null then
      select coalesce(sum(o.credits),0) into v_sem_credits
      from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id
      where e.round_id = p_round_id and e.student_id = v_student
        and e.status in ('requested','confirmed','waitlisted');
      if v_sem_credits + v_offering.credits > v_max_credits then
        return jsonb_build_object('ok', false,
          'reason', format('학기 이수 학점 상한(%s학점)을 초과합니다.', v_max_credits));
      end if;
    end if;
  end if;

  if v_offering.choice_group is not null then
    if exists (
      select 1 from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id
      where e.round_id = p_round_id and e.student_id = v_student
        and e.status in ('requested', 'confirmed', 'waitlisted')
        and o.choice_group = v_offering.choice_group
        and o.id <> p_offering_id
    ) then
      return jsonb_build_object('ok', false,
        'reason', format('「%s」 그룹에서는 한 과목만 신청할 수 있습니다.', v_offering.choice_group));
    end if;
  end if;

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
            and (o2.academic_year, o2.semester)
                < (v_offering.academic_year, v_offering.semester)
        )
        and not exists (
          select 1
          from public.curriculum_plans cp
          join public.curriculum_entries ce_pre
            on ce_pre.plan_id = cp.id and ce_pre.subject_id = pr.prerequisite_subject_id
          join public.curriculum_entries ce_tgt
            on ce_tgt.plan_id = cp.id and ce_tgt.subject_id = v_offering.subject_id
          where cp.admission_year = v_admission
            and (ce_pre.grade, ce_pre.semester) < (ce_tgt.grade, ce_tgt.semester)
        )
    ) then
      return jsonb_build_object('ok', false, 'reason', '선수과목을 아직 이수하지 않았습니다.');
    end if;
  end if;

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
