"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@/lib/types";
import { DAY_LABELS } from "@/lib/timetable/conflicts";
import {
  assignHomeroom,
  setHomeroomMeeting,
  setHomeroomRoom,
} from "@/app/actions/homeroom";

type OfferingRow = {
  offering_id: string;
  section_id: string | null;
  subject_name: string;
  credits: number;
  placed: number;
};

export default function HomeroomEditor({
  scope,
  scopes,
  classNo,
  classesPerGrade,
  periodsPerDay,
  daysPerWeek,
  ay,
  sem,
  grade,
  homeroomAssigned,
  offeringRows,
  meetings,
  rooms,
  currentRoomId,
}: {
  scope: string;
  scopes: string[];
  classNo: number;
  classesPerGrade: number;
  periodsPerDay: number;
  daysPerWeek: number;
  ay: number;
  sem: number;
  grade: number;
  homeroomAssigned: boolean;
  offeringRows: OfferingRow[];
  meetings: Array<{ section_id: string; day: number; period: number }>;
  rooms: Room[];
  currentRoomId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null); // "day-period"

  const days = Array.from({ length: daysPerWeek }, (_, i) => i + 1);
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const subjectBySection = useMemo(() => {
    const m = new Map<string, OfferingRow>();
    for (const o of offeringRows) if (o.section_id) m.set(o.section_id, o);
    return m;
  }, [offeringRows]);

  const meetingAt = useMemo(() => {
    const m = new Map<string, { section_id: string }>();
    for (const mt of meetings) m.set(`${mt.day}-${mt.period}`, mt);
    return m;
  }, [meetings]);

  function nav(next: { scope?: string; cls?: number }) {
    const s = next.scope ?? scope;
    const c = next.cls ?? classNo;
    router.push(`/admin/homeroom?scope=${s}&class=${c}`);
  }

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function place(day: number, period: number, sectionId: string) {
    setPicking(null);
    setMessage(null);
    startTransition(async () => {
      const r = await setHomeroomMeeting(sectionId, day, period, true);
      if (!r.ok) setMessage(r.message ?? "배치 실패");
      router.refresh();
    });
  }

  function clearCell(day: number, period: number, sectionId: string) {
    run(() => setHomeroomMeeting(sectionId, day, period, false));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">원반 시간표</h1>
          <p className="mt-1 text-sm text-slate-500">
            공통·학교지정 과목을 학급(원반) 시간표에 배치합니다. 선택과목은
            시간표 편성(밴드) 화면에서 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={scope}
            onChange={(e) => nav({ scope: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {scopes.map((s) => {
              const [y, se, g] = s.split("-");
              return (
                <option key={s} value={s}>
                  {y}학년도 {g}학년 {se}학기
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {!homeroomAssigned ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 mb-3">
            이 학년의 원반이 아직 편성되지 않았습니다. 지정과목을 학급별로
            배정하세요.
          </p>
          <button
            onClick={() =>
              run(async () => {
                const fd = new FormData();
                fd.set("academic_year", String(ay));
                fd.set("semester", String(sem));
                fd.set("grade", String(grade));
                const r = await assignHomeroom(fd);
                setMessage(r.message);
              })
            }
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
          >
            원반 편성 (지정과목 학급 배정)
          </button>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        </div>
      ) : (
        <>
          {/* 학급 선택 + 강의실 */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: classesPerGrade }, (_, i) => i + 1).map(
                (c) => (
                  <button
                    key={c}
                    onClick={() => nav({ cls: c })}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      c === classNo
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c}반
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-slate-500">학급 기본 강의실</label>
              <select
                value={currentRoomId ?? ""}
                onChange={(e) =>
                  run(() =>
                    setHomeroomRoom(
                      ay,
                      sem,
                      grade,
                      classNo,
                      e.target.value || null
                    )
                  )
                }
                disabled={isPending}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
              >
                <option value="">미지정</option>
                {rooms
                  .filter((r) => r.room_type === "일반교실" || !r.subject_group)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {message && (
            <div className="mb-3 text-sm rounded-lg bg-slate-100 text-slate-700 px-3 py-2">
              {message}
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_240px] gap-6">
            {/* 시간표 그리드 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[520px]">
                <thead>
                  <tr>
                    <th className="w-12 border border-slate-200 bg-slate-50 py-2 text-xs text-slate-400 font-normal">
                      교시
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        className="border border-slate-200 bg-slate-50 py-2 text-slate-600 font-medium"
                      >
                        {DAY_LABELS[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p}>
                      <td className="border border-slate-200 bg-slate-50 text-center text-xs text-slate-400 py-2">
                        {p}
                      </td>
                      {days.map((d) => {
                        const key = `${d}-${p}`;
                        const mt = meetingAt.get(key);
                        const placed = mt
                          ? subjectBySection.get(mt.section_id)
                          : null;
                        return (
                          <td
                            key={d}
                            className="border border-slate-200 p-1 align-top h-14 relative"
                          >
                            {placed ? (
                              <div className="group rounded bg-emerald-50 px-1.5 py-1 h-full">
                                <div className="text-xs font-medium text-slate-800">
                                  {placed.subject_name}
                                </div>
                                <button
                                  onClick={() =>
                                    clearCell(d, p, mt!.section_id)
                                  }
                                  disabled={isPending}
                                  className="absolute top-0.5 right-1 text-xs text-slate-300 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            ) : picking === key ? (
                              <select
                                autoFocus
                                defaultValue=""
                                onChange={(e) =>
                                  e.target.value &&
                                  place(d, p, e.target.value)
                                }
                                onBlur={() => setPicking(null)}
                                className="w-full text-xs rounded border border-slate-300 py-1"
                              >
                                <option value="">과목...</option>
                                {offeringRows
                                  .filter((o) => o.section_id)
                                  .map((o) => (
                                    <option key={o.offering_id} value={o.section_id!}>
                                      {o.subject_name} ({o.placed}/{o.credits})
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <button
                                onClick={() => setPicking(key)}
                                className="w-full h-full text-slate-200 hover:text-slate-400 hover:bg-slate-50 text-lg"
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 배치 진행 현황 */}
            <aside className="bg-white rounded-xl border border-slate-200 p-4 h-fit">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                {classNo}반 지정과목 배치
              </h3>
              <div className="space-y-1.5">
                {offeringRows.map((o) => {
                  const done = o.placed >= o.credits;
                  return (
                    <div
                      key={o.offering_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">{o.subject_name}</span>
                      <span
                        className={`text-xs tabular-nums ${
                          done ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {o.placed}/{o.credits}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                각 과목을 학점 수만큼 요일·교시에 배치하세요. 배치는 즉시
                저장되며 학생 시간표에 반영됩니다.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
