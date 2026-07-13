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
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">
          {profile!.name} 님, 안녕하세요
        </h1>
        {student && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            {student.grade
              ? `${student.grade}학년 ${student.class_no}반 ${student.number}번`
              : `학번 ${student.student_no}`}
          </p>
        )}
      </header>

      {/* 이수 진척 */}
      <div className="card p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">졸업 이수 진척</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              고교학점제 졸업 기준 192학점
            </p>
          </div>
          <span className="text-sm text-[var(--muted)] tnum">
            <span className="text-2xl font-bold text-[var(--accent)]">
              {earned}
            </span>
            <span className="mx-1">/</span>192
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--surface-sunken)] overflow-hidden ring-1 ring-inset ring-[var(--border)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: "var(--accent)" }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <Legend color="var(--accent)" label={`이수 ${earned}학점`} />
          <Legend color="var(--border-strong)" label={`진행중 ${inProgress}학점`} />
          {notMet > 0 && (
            <Legend color="var(--danger)" label={`미이수 ${notMet}과목`} />
          )}
        </div>
      </div>

      {/* 진행 중인 신청 */}
      <div className="mt-8">
        <h2 className="font-semibold text-[var(--ink)] mb-3">진행 중인 신청</h2>
        {rounds.length === 0 ? (
          <div className="card-dashed p-6 text-sm text-[var(--faint)]">
            현재 진행 중인 수요조사·수강신청이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => (
              <Link
                key={r.id}
                href={`/student/enroll/${r.id}`}
                className="group flex items-center justify-between rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[var(--accent-soft)] px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--ink)]">
                      {r.name}
                    </span>
                    <span className="badge badge-accent">
                      {ROUND_TYPE_LABEL[r.round_type]}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1 tnum">
                    마감 {fmt(r.closes_at)}
                  </p>
                </div>
                <span className="text-[var(--accent-ink)] text-sm font-semibold flex items-center gap-1">
                  신청하기
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 바로가기 */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <QuickLink
          href="/student/timetable"
          title="내 시간표"
          desc="공개된 시간표에서 요일·교시별 수업과 강의실을 확인합니다."
        />
        <QuickLink
          href="/student/rooms"
          title="수강 과목 · 강의실"
          desc="확정된 수강 과목과 배정 강의실·담당 교사를 확인합니다."
        />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--muted)]">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]"
    >
      <h2 className="font-semibold text-[var(--ink)] flex items-center gap-1">
        {title}
        <span className="text-[var(--faint)] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0">
          →
        </span>
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">{desc}</p>
    </Link>
  );
}
