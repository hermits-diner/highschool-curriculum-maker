-- 0003: 과목 마스터, 선수과목 규칙, 편제표

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  subject_group text not null,
  subject_type text not null check (subject_type in ('공통', '일반선택', '진로선택', '융합선택', '창체')),
  default_credits int not null,
  min_credits int not null,
  max_credits int not null,
  is_custom boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (min_credits <= default_credits and default_credits <= max_credits)
);

create table public.prerequisite_rules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  prerequisite_subject_id uuid not null references public.subjects (id) on delete cascade,
  enforcement text not null default 'required' check (enforcement in ('required', 'recommended')),
  unique (subject_id, prerequisite_subject_id),
  check (subject_id <> prerequisite_subject_id)
);

create table public.curriculum_plans (
  id uuid primary key default gen_random_uuid(),
  admission_year int not null unique,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  updated_at timestamptz not null default now()
);

create table public.curriculum_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.curriculum_plans (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  grade int not null check (grade between 1 and 3),
  semester int not null check (semester in (1, 2)),
  credits int not null check (credits > 0),
  is_required boolean not null default false,
  choice_group text,
  note text,
  unique (plan_id, subject_id, grade, semester)
);

create index curriculum_entries_plan_idx on public.curriculum_entries (plan_id);

-- RLS: 기준 정보는 로그인 사용자 전체 조회, 변경은 관리자만
alter table public.subjects enable row level security;
alter table public.prerequisite_rules enable row level security;
alter table public.curriculum_plans enable row level security;
alter table public.curriculum_entries enable row level security;

create policy subjects_select on public.subjects
  for select using (auth.uid() is not null);
create policy subjects_admin_all on public.subjects
  for all using (public.is_admin()) with check (public.is_admin());

create policy prereq_select on public.prerequisite_rules
  for select using (auth.uid() is not null);
create policy prereq_admin_all on public.prerequisite_rules
  for all using (public.is_admin()) with check (public.is_admin());

create policy plans_select on public.curriculum_plans
  for select using (auth.uid() is not null);
create policy plans_admin_all on public.curriculum_plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy entries_select on public.curriculum_entries
  for select using (auth.uid() is not null);
create policy entries_admin_all on public.curriculum_entries
  for all using (public.is_admin()) with check (public.is_admin());
