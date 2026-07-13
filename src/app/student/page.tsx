import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { EnrollmentRound } from "@/lib/types";

const ROUND_TYPE_LABEL: Record<string, string> = {
  survey: "수요조사",
  register: "수강신청",
  adjust: "수강신청 정정",
};

function fmt(dt: string) {
  const d = new Date(dt);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function StudentDashboard() {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("student_no, grade, class_no, number, admission_year")
    .eq("id", profile!.id)
    .single();

  const nowIso = new Date().toISOString();
  const { data: openRounds } = await supabase
    .from("enrollment_rounds")
    .select("*")
    .eq("target_grade", student?.grade ?? -1)
    .lte("opens_at", nowIso)
    .gte("closes_at", nowIso)
    .order("closes_at");

  const rounds = (openRounds ?? []) as EnrollmentRound[];

  // 이수 진척 (192학점)
  const { data: credits } = await supabase
    .from("v_student_credits")
    .select("credits, result")
    .eq("student_id", profile!.id);
  const earned = (credits ?? [])
    .filter((c) => c.result === "passed")
    .reduce((s, c) => s + (c.credits as number), 0);
  const inProgress = (credits ?? [])
    .filter((c) => c.result === "in_progress")
    .reduce((s, c) => s + (c.credits as number), 0);
  const notMet = (credits ?? []).filter((c) => c.result === "not_met").length;
  const pct = Math.min(100, Math.round((earned / 192) * 100));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">
        {profile!.name} 님, 안녕하세요
      </h1>
      {student && (
        <p className="mt-1 text-sm text-slate-500">
          {student.grade
            ? `${student.grade}학년 ${student.class_no}반 ${student.number}번`
            : `학번 ${student.student_no}`}
        </p>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800">졸업 이수 진척</h2>
          <span className="text-sm text-slate-500">
            <span className="text-lg font-bold text-blue-600">{earned}</span> /
            192학점
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>이수 {earned}학점</span>
          <span>진행중 {inProgress}학점</span>
          {notMet > 0 && (
            <span className="text-red-600">미이수 {notMet}과목</span>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-slate-800 mb-3">진행 중인 신청</h2>
        {rounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
            현재 진행 중인 수요조사·수강신청이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => (
              <Link
                key={r.id}
                href={`/student/enroll/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 px-5 py-4 hover:border-blue-400 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {r.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {ROUND_TYPE_LABEL[r.round_type]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    마감: {fmt(r.closes_at)}
                  </p>
                </div>
                <span className="text-blue-600 text-sm font-medium">
                  신청하기 →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/student/timetable"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 transition-colors"
        >
          <h2 className="font-semibold text-slate-800">내 시간표</h2>
          <p className="mt-1 text-sm text-slate-500">
            공개된 시간표에서 요일·교시별 수업과 강의실을 확인합니다.
          </p>
        </Link>
        <Link
          href="/student/rooms"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 transition-colors"
        >
          <h2 className="font-semibold text-slate-800">수강 과목 · 강의실</h2>
          <p className="mt-1 text-sm text-slate-500">
            확정된 수강 과목과 배정 강의실·담당 교사를 확인합니다.
          </p>
        </Link>
      </div>
    </div>
  );
}
