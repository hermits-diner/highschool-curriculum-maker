import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MENU = [
  {
    href: "/admin/settings",
    title: "학교 설정",
    desc: "학급 수, 학기당 학점 범위, 폐강 기준 등 기본 파라미터",
    ready: true,
  },
  {
    href: "/admin/subjects",
    title: "과목 관리",
    desc: "2022 개정 보통교과 과목 마스터와 선수과목(위계) 규칙",
    ready: true,
  },
  {
    href: "/admin/curriculum",
    title: "편제표 작성",
    desc: "입학년도별 3개년 편제표 작성과 규정 자동 검증",
    ready: true,
  },
  {
    href: "/admin/students",
    title: "학생 계정",
    desc: "CSV 일괄 등록, 비밀번호 초기화",
    ready: true,
  },
  {
    href: "/admin/rounds",
    title: "수요조사·수강신청",
    desc: "라운드 개설·마감, 수요 집계, 개설 확정",
    ready: true,
  },
  {
    href: "/admin/rooms",
    title: "강의실 관리",
    desc: "교과교실 등록 (교과군별 강의실)",
    ready: true,
  },
  {
    href: "/admin/sections",
    title: "분반 · 강의실 배정",
    desc: "확정 인원 자동 분반, 담당 교사·강의실 지정",
    ready: true,
  },
  {
    href: "/admin/timetable",
    title: "시간표 편성",
    desc: "밴드 편성, 충돌 검증, 시간표 공개",
    ready: true,
  },
];

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("school_settings")
    .select("school_name")
    .eq("id", 1)
    .single();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">
        {settings?.school_name ?? "학교"} 교육과정 관리
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        2022 개정교육과정(고교학점제) 편성 관리자 화면입니다.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU.map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <h2 className="font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            </Link>
          ) : (
            <div
              key={item.href}
              className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5"
            >
              <h2 className="font-semibold text-slate-400">
                {item.title}
                <span className="ml-2 text-xs font-normal">준비 중</span>
              </h2>
              <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
