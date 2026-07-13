-- 0001_init: 계정(프로필/학생/교사), 학교 설정, RLS 헬퍼·정책

-- ── 프로필 ───────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')),
  name text not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key references public.profiles (id) on delete cascade,
  student_no text not null unique,
  admission_year int not null,
  grade int check (grade between 1 and 3),
  class_no int,
  number int,
  status text not null default '재학' check (status in ('재학', '휴학', '전출', '졸업')),
  created_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key references public.profiles (id) on delete cascade,
  subject_group text,
  max_weekly_periods int not null default 16
);

-- ── 학교 설정 (singleton) ─────────────────────────────────
create table public.school_settings (
  id int primary key check (id = 1),
  school_name text not null default '우리학교',
  classes_per_grade int not null default 10,
  min_credits_per_semester int not null default 28,
  max_credits_per_semester int not null default 36,
  max_subjects_per_semester int,
  min_students_to_open int not null default 13,
  default_section_capacity int not null default 28,
  periods_per_day int not null default 7,
  days_per_week int not null default 5,
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id) values (1);

-- ── 역할 헬퍼 ─────────────────────────────────────────────
-- security definer로 RLS를 우회해 profiles를 조회하므로 정책 내 재귀가 발생하지 않는다.
create or replace function public.fn_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.fn_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.fn_role() in ('admin', 'teacher'), false)
$$;

-- ── RLS ──────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.school_settings enable row level security;

-- profiles: 본인 행 또는 교직원은 전체 조회, 관리자는 전체 권한
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- students: 본인 행 또는 교직원 조회, 관리자 전체 권한
create policy students_select on public.students
  for select using (id = auth.uid() or public.is_staff());
create policy students_admin_all on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- teachers: 로그인 사용자 전체 조회(담당 교사 표시용), 관리자 전체 권한
create policy teachers_select on public.teachers
  for select using (auth.uid() is not null);
create policy teachers_admin_all on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());

-- school_settings: 로그인 사용자 조회, 관리자 수정
create policy settings_select on public.school_settings
  for select using (auth.uid() is not null);
create policy settings_admin_all on public.school_settings
  for all using (public.is_admin()) with check (public.is_admin());
