-- 0008: 동시수강 매트릭스 (밴드 편성 충돌 판단용)
create or replace function public.co_enrollment_matrix(p_ay int, p_sem int, p_grade int)
returns table(offering_a uuid, offering_b uuid, shared int)
language sql stable security definer
set search_path = public
as $$
  select e1.offering_id, e2.offering_id, count(*)::int
  from public.enrollments e1
  join public.enrollments e2
    on e1.student_id = e2.student_id and e1.offering_id < e2.offering_id
  join public.course_offerings o1 on o1.id = e1.offering_id
  join public.course_offerings o2 on o2.id = e2.offering_id
  where e1.status = 'confirmed' and e2.status = 'confirmed'
    and o1.academic_year = p_ay and o1.semester = p_sem and o1.grade = p_grade
    and o2.academic_year = p_ay and o2.semester = p_sem and o2.grade = p_grade
  group by e1.offering_id, e2.offering_id;
$$;

grant execute on function public.co_enrollment_matrix(int, int, int) to authenticated;
