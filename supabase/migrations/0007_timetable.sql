-- 0007: 시간표 (밴드/블록 편성, 분반 회차, 공개 스위치)

-- 밴드: 같은 시간대에 동시 개설되는 선택과목 묶음 (학생은 밴드당 1과목 → 충돌 원천 차단)
create table public.bands (
  id uuid primary key default gen_random_uuid(),
  academic_year int not null,
  semester int not null check (semester in (1, 2)),
  grade int not null check (grade between 1 and 3),
  name text not null,
  created_at timestamptz not null default now()
);

-- 밴드가 점유하는 요일·교시 (주당 슬롯 수 = 과목 학점(시수))
create table public.band_slots (
  band_id uuid not null references public.bands (id) on delete cascade,
  day int not null check (day between 1 and 6),
  period int not null check (period between 1 and 10),
  primary key (band_id, day, period)
);

-- 개설과목 → 밴드 배정
alter table public.course_offerings
  add column band_id uuid references public.bands (id) on delete set null;

-- 분반 회차 (조회용 최종 진실): 분반 × 요일·교시 × 강의실
create table public.section_meetings (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  day int not null check (day between 1 and 6),
  period int not null check (period between 1 and 10),
  room_id uuid references public.rooms (id) on delete set null,
  unique (section_id, day, period)
);

create index section_meetings_section_idx on public.section_meetings (section_id);

-- 시간표 공개 스위치 (학년별)
create table public.timetables (
  academic_year int not null,
  semester int not null check (semester in (1, 2)),
  grade int not null check (grade between 1 and 3),
  status text not null default 'draft' check (status in ('draft', 'published')),
  updated_at timestamptz not null default now(),
  primary key (academic_year, semester, grade)
);

-- 학생 개인 시간표 뷰 (공개 여부는 앱에서 timetables.status로 게이트)
create or replace view public.v_student_timetable
with (security_invoker = true) as
select
  e.student_id,
  o.academic_year,
  o.semester,
  o.grade,
  sm.day,
  sm.period,
  sub.name as subject_name,
  sub.subject_group,
  sec.section_no,
  r.name as room_name,
  tp.name as teacher_name
from public.enrollments e
join public.sections sec on sec.id = e.section_id
join public.section_meetings sm on sm.section_id = sec.id
join public.course_offerings o on o.id = e.offering_id
join public.subjects sub on sub.id = o.subject_id
left join public.rooms r on r.id = sm.room_id
left join public.teachers t on t.id = sec.teacher_id
left join public.profiles tp on tp.id = t.id
where e.status = 'confirmed';

alter table public.bands enable row level security;
alter table public.band_slots enable row level security;
alter table public.section_meetings enable row level security;
alter table public.timetables enable row level security;

create policy bands_select on public.bands
  for select using (auth.uid() is not null);
create policy bands_admin_all on public.bands
  for all using (public.is_admin()) with check (public.is_admin());

create policy band_slots_select on public.band_slots
  for select using (auth.uid() is not null);
create policy band_slots_admin_all on public.band_slots
  for all using (public.is_admin()) with check (public.is_admin());

create policy meetings_select on public.section_meetings
  for select using (auth.uid() is not null);
create policy meetings_admin_all on public.section_meetings
  for all using (public.is_admin()) with check (public.is_admin());

create policy timetables_select on public.timetables
  for select using (auth.uid() is not null);
create policy timetables_admin_all on public.timetables
  for all using (public.is_admin()) with check (public.is_admin());
