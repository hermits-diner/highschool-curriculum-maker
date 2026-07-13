# 고교 교육과정 편성 시스템

2022 개정교육과정(고교학점제) 기반 일반계 고등학교 교육과정 편성·수강신청·시간표 관리 웹앱.
관리자·교사·학생 3종 역할을 지원하며, 편제표 작성부터 수강신청, 분반·강의실 배정,
시간표 편성, 이수 관리까지 한 곳에서 처리합니다.

## 기술 스택

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **Supabase** (Postgres, Auth, Row Level Security)
- 배포: Vercel(앱) + Supabase 클라우드

## 주요 기능

| 역할 | 기능 |
|---|---|
| 관리자 | 학교 설정, 과목·선수과목 관리, 편제표 작성(규정 자동 검증), 학생 계정(CSV 등록), 수요조사·수강신청 운영, 분반·강의실 배정, 원반/선택 시간표 편성, 이수 현황 |
| 교사 | 담당 분반 명단, 이수 성적(출석·성취율) 입력 |
| 학생 | 수요조사·수강신청, 개인 시간표, 수강 과목·강의실 조회, 졸업 이수 진척 |

## 초기 설정

### 1. 환경 변수 (`.env.local`)

`.env.example`을 복사해 채웁니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN=student.invalid
SUPABASE_SECRET_KEY=<secret key>   # 학생 CSV 등록·학년 진급에 필요
```

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 대시보드 → Project Settings → API Keys → publishable key
- `SUPABASE_SECRET_KEY`: 같은 화면의 **secret key** (서버 전용, 절대 클라이언트에 노출 금지)

### 2. 데이터베이스 마이그레이션

`supabase/migrations/` 의 SQL을 순서대로 적용합니다 (Supabase SQL Editor 또는 CLI).

### 3. 과목 시드

```bash
node scripts/gen-seed.mjs   # data/*.json → supabase/seed.sql 생성
```

생성된 `supabase/seed.sql`을 실행하면 2022 개정 보통교과 과목과 선수과목 규칙이 등록됩니다.
과목을 수정하려면 `data/subjects-2022.json`을 고친 뒤 위 명령을 다시 실행하세요.
(재실행 안전 — `on conflict` upsert)

### 4. 최초 관리자 계정

`supabase/seed_accounts.sql`을 실행해 관리자 계정을 만듭니다
(이메일 `admin@school.test`, 초기 비밀번호 `admin1234!` — 로그인 후 변경 권장).

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 + 타입체크
npx vitest run     # 규정 검증·시간표 충돌·분반 로직 단위 테스트
```

## 운영 흐름

편제표 작성·확정 → 개설과목 생성 → (수요조사 →) 정식 수강신청 → 개설 확정/폐강
→ 분반 편성 + 강의실 배정 → 원반/선택 시간표 편성 → 충돌 검증 → 공개
→ 학기 중 이수 성적 입력 → 이수/미이수 관리 → (학기말) 학년 진급·차년도 편제표 복제

## 도메인 규정 (교육부 고시 제2022-33호)

졸업 192학점(교과 174 + 창체 18), 필수이수 84, 국·수·영 ≤ 81, 체육 매 학기,
1학점 = 50분×16회, 이수 기준 출석 2/3(+공통과목 성취율 40%). 규정 상수는
`src/lib/validation/curriculum-rules.ts`에 모여 있어 고시 개정 시 이 파일만 수정합니다.

## 향후 과제

- 밴드 편성 자동 최적화(동시수강 매트릭스 기반 그래프 분할, WebWorker)
- 과목 마스터를 NCIC 원문 231개와 최종 대조
- 학부모 계정, 공동교육과정(교실온닷) 연계
- NEIS 연동 포맷 내보내기
