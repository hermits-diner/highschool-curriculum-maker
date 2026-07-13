"use client";

import { useState, useTransition } from "react";
import { setAchievement } from "@/app/actions/achievements";

export type RosterStudent = {
  student_id: string;
  offering_id: string;
  student_no: string;
  name: string;
  loc: string;
  attendance_ok: boolean;
  achievement_pct: number | null;
};

export type RosterSection = {
  id: string;
  section_no: number;
  subjectName: string;
  subjectType: string;
  credits: number;
  academicYear: number;
  semester: number;
  roomName: string | null;
  students: RosterStudent[];
};

/** 성취율 → 5단계 성취도 */
function level(pct: number | null): string {
  if (pct == null) return "-";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "E";
}

function passResult(
  subjectType: string,
  attendanceOk: boolean,
  pct: number | null
): "passed" | "not_met" | "in_progress" {
  if (pct == null && attendanceOk) return "in_progress";
  if (!attendanceOk) return "not_met";
  if (subjectType === "공통" && (pct ?? 0) < 40) return "not_met";
  return "passed";
}

export default function RosterEditor({
  sections,
}: {
  sections: RosterSection[];
}) {
  return (
    <div className="mt-6 space-y-6">
      {sections.map((sec) => (
        <SectionCard key={sec.id} section={sec} />
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: RosterSection }) {
  const [students, setStudents] = useState(section.students);
  const [isPending, startTransition] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);

  function save(s: RosterStudent, attendanceOk: boolean, pct: number | null) {
    setStudents((prev) =>
      prev.map((x) =>
        x.student_id === s.student_id
          ? { ...x, attendance_ok: attendanceOk, achievement_pct: pct }
          : x
      )
    );
    startTransition(async () => {
      const r = await setAchievement(
        s.student_id,
        s.offering_id,
        attendanceOk,
        pct
      );
      if (r.ok) {
        setSavedId(s.student_id);
        setTimeout(() => setSavedId(null), 1200);
      }
    });
  }

  const notMet = students.filter(
    (s) =>
      passResult(section.subjectType, s.attendance_ok, s.achievement_pct) ===
      "not_met"
  ).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-slate-900">
            {section.subjectName}
          </span>
          <span className="ml-2 text-xs text-slate-400">
            {section.academicYear}학년도 {section.semester}학기 ·{" "}
            {section.section_no}분반
            {section.roomName ? ` · ${section.roomName}` : ""} ·{" "}
            {section.subjectType}
          </span>
        </div>
        <span className="text-sm text-slate-500">
          {students.length}명
          {notMet > 0 && (
            <span className="ml-2 text-red-600">미도달 {notMet}</span>
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1.5">번호</th>
              <th className="px-2 py-1.5">이름</th>
              <th className="px-2 py-1.5 text-center">출석충족</th>
              <th className="px-2 py-1.5 text-center">성취율(%)</th>
              <th className="px-2 py-1.5 text-center">성취도</th>
              <th className="px-2 py-1.5 text-center">이수</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const result = passResult(
                section.subjectType,
                s.attendance_ok,
                s.achievement_pct
              );
              return (
                <tr key={s.student_id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 text-slate-400 text-xs">
                    {s.loc || s.student_no}
                  </td>
                  <td className="px-2 py-1.5 text-slate-800">{s.name}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={s.attendance_ok}
                      onChange={(e) =>
                        save(s, e.target.checked, s.achievement_pct)
                      }
                      disabled={isPending}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={s.achievement_pct ?? ""}
                      onChange={(e) =>
                        setStudents((prev) =>
                          prev.map((x) =>
                            x.student_id === s.student_id
                              ? {
                                  ...x,
                                  achievement_pct:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : x
                          )
                        )
                      }
                      onBlur={(e) =>
                        save(
                          s,
                          s.attendance_ok,
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      disabled={isPending}
                      className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-600">
                    {level(s.achievement_pct)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {savedId === s.student_id ? (
                      <span className="text-xs text-emerald-600">저장됨</span>
                    ) : (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          result === "passed"
                            ? "bg-emerald-50 text-emerald-700"
                            : result === "not_met"
                              ? "bg-red-50 text-red-600"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {result === "passed"
                          ? "이수"
                          : result === "not_met"
                            ? "미이수"
                            : "진행중"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
