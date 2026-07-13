-- 0010: 원반(행정학급) 지정과목 배정 지원
alter table public.sections add column if not exists class_no int;
alter table public.enrollments alter column round_id drop not null;
create index if not exists sections_class_idx on public.sections (offering_id, class_no);
