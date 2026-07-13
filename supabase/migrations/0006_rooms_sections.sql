-- 0006: 강의실, 분반, 학생-분반 배정

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  room_type text not null default '일반교실'
    check (room_type in ('일반교실', '교과교실', '특별실')),
  subject_group text,               -- 교과교실제: 교과(군)별 강의실 조회 키
  capacity int not null default 30,
  created_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  section_no int not null,
  teacher_id uuid references public.teachers (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  capacity int not null default 28,
  created_at timestamptz not null default now(),
  unique (offering_id, section_no)
);

create index sections_offering_idx on public.sections (offering_id);

-- 학생 배정: enrollments에 분반 연결
alter table public.enrollments
  add column section_id uuid references public.sections (id) on delete set null;

-- 학생 개인 배정 조회 뷰 (Phase 5에서 시간·강의실 회차가 붙지만, 기본 배정은 여기서 조회)
create view public.v_student_assignment
with (security_invoker = true) as
select
  e.student_id,
  o.academic_year,
  o.semester,
  o.grade,
  sub.name as subject_name,
  sub.subject_group,
  o.credits,
  o.choice_group,
  sec.id as section_id,
  sec.section_no,
  r.name as room_name,
  r.subject_group as room_subject_group,
  tp.name as teacher_name
from public.enrollments e
join public.course_offerings o on o.id = e.offering_id
join public.subjects sub on sub.id = o.subject_id
left join public.sections sec on sec.id = e.section_id
left join public.rooms r on r.id = sec.room_id
left join public.teachers t on t.id = sec.teacher_id
left join public.profiles tp on tp.id = t.id
where e.status = 'confirmed';

-- RLS
alter table public.rooms enable row level security;
alter table public.sections enable row level security;

create policy rooms_select on public.rooms
  for select using (auth.uid() is not null);
create policy rooms_admin_all on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

create policy sections_select on public.sections
  for select using (auth.uid() is not null);
create policy sections_admin_all on public.sections
  for all using (public.is_admin()) with check (public.is_admin());
