-- ============================================================
-- 테스트 데이터 삭제 스크립트
-- ============================================================
-- 목적: 개발·시연 중 만든 테스트 데이터를 지우고 실서비스 시작 전
--       깨끗한 상태로 만든다.
--
-- 보존되는 것:
--   • subjects (2022 개정 과목 156개)          ← 참고 시드
--   • prerequisite_rules (선수과목 규칙 47개)   ← 참고 시드
--   • school_settings (학교 설정 1행)
--   • admin@school.test 관리자 계정            ← 로그인 유지용
--
-- 삭제되는 것:
--   • 편제표·개설과목·수강신청·분반·강의실·시간표·성적 등 모든 편성/운영 데이터
--   • 테스트 학생 계정(전부) 및 테스트 교사 계정(관리자 제외 전부)
--
-- ⚠️ 경고
--   1. 이 스크립트는 "실데이터 입력 전 1회" 실행하세요.
--   2. 학생은 합성 이메일(@student.invalid)을 쓰므로, 실제 학생을 등록한
--      뒤에 실행하면 실제 학생도 삭제됩니다. 반드시 데이터 입력 전에만!
--   3. 되돌릴 수 없습니다. 실행 전 Supabase 백업(또는 확신)을 권장합니다.
--   4. Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- ============================================================

begin;

-- 1) 편성·운영 데이터 전량 삭제 (자식→부모 순서, 전부 테스트 데이터)
delete from public.achievements;
delete from public.section_meetings;
delete from public.enrollments;
delete from public.sections;
delete from public.band_slots;
delete from public.bands;
delete from public.timetables;
delete from public.course_offerings;
delete from public.enrollment_rounds;
delete from public.rooms;
delete from public.curriculum_entries;
delete from public.curriculum_plans;

-- 2) 테스트 계정 삭제
--    auth.users 삭제 시 profiles → students/teachers 가 연쇄 삭제됩니다.
--    관리자(admin@school.test)는 보존.
delete from auth.users
where email like '%@student.invalid'                       -- 모든 학생(합성 이메일)
   or (email like '%@school.test' and email <> 'admin@school.test');  -- 관리자 외 교사

commit;

-- ============================================================
-- (선택) 관리자 계정까지 완전히 초기화하고 seed_accounts.sql 로
--        새로 만들고 싶다면 아래 주석을 해제해 별도로 실행하세요.
--        실행하면 즉시 로그아웃되며, 다시 로그인하려면
--        supabase/seed_accounts.sql 을 실행해야 합니다.
-- ------------------------------------------------------------
-- delete from auth.users where email = 'admin@school.test';
-- ============================================================

-- 삭제 후 남은 데이터 확인
select
  (select count(*) from auth.users)                as users,
  (select count(*) from public.profiles)           as profiles,
  (select count(*) from public.students)           as students,
  (select count(*) from public.teachers)           as teachers,
  (select count(*) from public.curriculum_plans)   as plans,
  (select count(*) from public.course_offerings)   as offerings,
  (select count(*) from public.enrollments)        as enrollments,
  (select count(*) from public.subjects)           as subjects_kept,
  (select count(*) from public.prerequisite_rules) as prereq_kept;
