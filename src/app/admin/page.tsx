import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type MenuKey =
  | "settings"
  | "subjects"
  | "curriculum"
  | "students"
  | "rounds"
  | "rooms"
  | "sections"
  | "homeroom"
  | "timetable"
  | "progress";

const MENU: {
  href: string;
  title: string;
  desc: string;
  icon: MenuKey;
  step: number;
}[] = [
  { href: "/admin/settings", title: "학교 설정", desc: "학급 수, 학기당 학점 범위, 폐강 기준 등 기본 파라미터", icon: "settings", step: 1 },
  { href: "/admin/subjects", title: "과목 관리", desc: "2022 개정 보통교과 과목 마스터와 선수과목(위계) 규칙", icon: "subjects", step: 2 },
  { href: "/admin/curriculum", title: "편제표 작성", desc: "입학년도별 3개년 편제표 작성과 규정 자동 검증", icon: "curriculum", step: 3 },
  { href: "/admin/students", title: "학생 계정", desc: "CSV 일괄 등록, 비밀번호 초기화, 학년 진급", icon: "students", step: 4 },
  { href: "/admin/rounds", title: "수요조사·수강신청", desc: "라운드 개설·마감, 수요 집계, 개설 확정", icon: "rounds", step: 5 },
  { href: "/admin/rooms", title: "강의실 관리", desc: "교과교실 등록 (교과군별 강의실)", icon: "rooms", step: 6 },
  { href: "/admin/sections", title: "분반 · 강의실 배정", desc: "확정 인원 자동 분반, 담당 교사·강의실 지정", icon: "sections", step: 7 },
  { href: "/admin/homeroom", title: "원반 시간표", desc: "공통·지정과목을 학급(원반) 시간표에 배치", icon: "homeroom", step: 8 },
  { href: "/admin/timetable", title: "시간표 편성", desc: "밴드 편성, 충돌 검증, 시간표 공개", icon: "timetable", step: 9 },
  { href: "/admin/progress", title: "이수 현황", desc: "출석·성취율 기반 이수/미이수, 192학점 진척", icon: "progress", step: 10 },
];

function Icon({ name }: { name: MenuKey }) {
  const p: Record<MenuKey, React.ReactNode> = {
    settings: <><path d="M4 7h10M4 12h6M4 17h12" /><circle cx="16" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="17" r="1.6" /></>,
    subjects: <><rect x="4" y="4" width="14" height="14" rx="2" /><path d="M8 4v14" /></>,
    curriculum: <><rect x="3.5" y="4" width="15" height="14" rx="2" /><path d="M3.5 9h15M9 9v9" /></>,
    students: <><circle cx="8" cy="8" r="2.4" /><path d="M4 17c0-2.4 1.8-4 4-4s4 1.6 4 4" /><circle cx="15" cy="9" r="2" /><path d="M14 13.4c2 .2 3.5 1.7 3.5 3.6" /></>,
    rounds: <><rect x="5" y="4" width="12" height="15" rx="2" /><path d="M8.5 9l1.5 1.5L13 7M8.5 14h5" /></>,
    rooms: <><path d="M5 18V8l6-3 6 3v10M9 18v-4h4v4" /></>,
    sections: <><circle cx="7" cy="7" r="2" /><circle cx="15" cy="7" r="2" /><circle cx="7" cy="15" r="2" /><circle cx="15" cy="15" r="2" /></>,
    homeroom: <><rect x="4" y="5" width="14" height="13" rx="2" /><path d="M4 9h14M8 3.5v3M14 3.5v3" /></>,
    timetable: <><rect x="4" y="5" width="14" height="13" rx="2" /><path d="M4 9h14M9 9v9M14 9v9M4 13.5h14" /></>,
    progress: <><path d="M4 17V9M9.5 17V5M15 17v-6" /><path d="M3 19h16" /></>,
  };
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("school_settings")
    .select("school_name")
    .eq("id", 1)
    .single();

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-wide text-[var(--accent-ink)] uppercase">
          관리자
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--ink)]">
          {settings?.school_name ?? "학교"} 교육과정 관리
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          2022 개정교육과정(고교학점제) 편성을 순서대로 진행합니다.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]"
          >
            <div className="flex items-start justify-between">
              <span className="grid place-items-center w-10 h-10 rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                <Icon name={item.icon} />
              </span>
              <span className="text-[0.7rem] font-semibold text-[var(--faint)] tnum">
                {String(item.step).padStart(2, "0")}
              </span>
            </div>
            <h2 className="mt-3.5 font-semibold text-[var(--ink)] flex items-center gap-1">
              {item.title}
              <span className="text-[var(--faint)] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0">
                →
              </span>
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              {item.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
