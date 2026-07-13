-- 0004: 수요조사·수강신청 (라운드, 개설과목, 신청)

create table public.enrollment_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year int not null,
  target_grade int not null check (target_grade between 1 and 3),
  semester int not null check (semester in (1, 2)),
  round_type text not null check (round_type in ('survey', 'register', 'adjust')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  max_choices int,
  created_at timestamptz not null default now()
);

create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null,
  semester int not null check (semester in (1, 2)),
  grade int not null check (grade between 1 and 3),
  subject_id uuid not null references public.subjects (id),
  curriculum_entry_id uuid references public.curriculum_entries (id) on delete set null,
  credits int not null,
  is_required boolean not null default false,
  choice_group text,
  capacity int not null default 28,
  min_students int not null default 13,
  status text not null default 'planned'
    check (status in ('planned', 'surveying', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (academic_year, semester, grade, subject_id)
);

create index course_offerings_asg_idx
  on public.course_offerings (academic_year, semester, grade);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.enrollment_rounds (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  status text not null
    check (status in ('requested', 'confirmed', 'waitlisted', 'cancelled')),
  priority int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, student_id, offering_id)
);

create index enrollments_offering_idx on public.enrollments (offering_id, status);
create index enrollments_student_idx on public.enrollments (student_id, round_id);

-- 수요/신청 집계 뷰
create view public.v_offering_demand
with (security_invoker = true) as
select
  e.round_id,
  e.offering_id,
  count(*) filter (where e.status in ('requested', 'confirmed', 'waitlisted')) as demand,
  count(*) filter (where e.status = 'confirmed') as confirmed_count,
  count(*) filter (where e.status = 'waitlisted') as waitlisted_count
from public.enrollments e
group by e.round_id, e.offering_id;

-- RLS
alter table public.enrollment_rounds enable row level security;
alter table public.course_offerings enable row level security;
alter table public.enrollments enable row level security;

create policy rounds_select on public.enrollment_rounds
  for select using (auth.uid() is not null);
create policy rounds_admin_all on public.enrollment_rounds
  for all using (public.is_admin()) with check (public.is_admin());

create policy offerings_select on public.course_offerings
  for select using (auth.uid() is not null);
create policy offerings_admin_all on public.course_offerings
  for all using (public.is_admin()) with check (public.is_admin());

-- enrollments: 학생은 본인 것만 조회, 교직원은 전체 조회. 변경은 RPC(security definer)로만.
create policy enrollments_select_own on public.enrollments
  for select using (student_id = auth.uid() or public.is_staff());
create policy enrollments_admin_all on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());
