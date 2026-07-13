"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourseOffering, Subject } from "@/lib/types";
import { DAY_LABELS, type Conflict } from "@/lib/timetable/conflicts";
import {
  createBand,
  deleteBand,
  generateMeetings,
  setOfferingBand,
  setTimetableStatus,
  toggleBandSlot,
} from "@/app/actions/timetable";
import ConfirmButton from "@/components/ConfirmButton";

type BandInfo = { id: string; name: string };
type SectionInfo = { id: string; section_no: number; meetingCount: number };

export default function TimetableBoard({
  scope,
  scopes,
  periodsPerDay,
  daysPerWeek,
  offerings,
  subjectsById,
  bands,
  bandSlots,
  sectionsByOffering,
  coEnrollment,
  conflicts,
  timetableStatus,
}: {
  scope: string;
  scopes: string[];
  periodsPerDay: number;
  daysPerWeek: number;
  offerings: CourseOffering[];
  subjectsById: Record<string, Subject>;
  bands: BandInfo[];
  bandSlots: Array<{ band_id: string; day: number; period: number }>;
  sectionsByOffering: Record<string, SectionInfo[]>;
  coEnrollment: Array<{ a: string; b: string; shared: number }>;
  conflicts: Conflict[];
  timetableStatus: string;
}) {
  const router = useRouter();
  const [ay, sem, grade] = scope.split("-").map(Number);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const days = Array.from({ length: daysPerWeek }, (_, i) => i + 1);
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const slotsByBand = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of bandSlots) {
      const set = map.get(s.band_id) ?? new Set();
      set.add(`${s.day}-${s.period}`);
      map.set(s.band_id, set);
    }
    return map;
  }, [bandSlots]);

  const coMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of coEnrollment) {
      m.set(`${c.a}:${c.b}`, c.shared);
      m.set(`${c.b}:${c.a}`, c.shared);
    }
    return m;
  }, [coEnrollment]);

  const offeringsByBand = useMemo(() => {
    const map = new Map<string | null, CourseOffering[]>();
    for (const o of offerings) {
      const key = o.band_id ?? null;
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return map;
  }, [offerings]);

  const unassigned = offeringsByBand.get(null) ?? [];

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  // 밴드 내부 충돌: 같은 밴드 과목쌍 중 공동수강 > 0
  function bandInternalConflict(bandOfferings: CourseOffering[]): number {
    let total = 0;
    for (let i = 0; i < bandOfferings.length; i++) {
      for (let j = i + 1; j < bandOfferings.length; j++) {
        total += coMap.get(`${bandOfferings[i].id}:${bandOfferings[j].id}`) ?? 0;
      }
    }
    return total;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">시간표 편성</h1>
          <p className="mt-1 text-sm text-slate-500">
            경합 선택과목을 밴드로 묶고 요일·교시를 지정하면, 학생은 밴드당
            1과목만 들어 시간 충돌이 없습니다.
          </p>
        </div>
        <select
          value={scope}
          onChange={(e) =>
            router.push(`/admin/timetable?scope=${e.target.value}`)
          }
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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() =>
            run(() =>
              createBand(ay, sem, grade, `밴드 ${String.fromCharCode(65 + bands.length)}`)
            )
          }
          disabled={isPending}
          className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
        >
          + 밴드 추가
        </button>
        <button
          onClick={() =>
            run(async () => {
              const r = await generateMeetings(ay, sem, grade);
              setMessage(r.message);
            })
          }
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          시간표 생성
        </button>
        {timetableStatus === "published" ? (
          <button
            onClick={() =>
              run(() => setTimetableStatus(ay, sem, grade, "draft"))
            }
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            공개 취소
          </button>
        ) : (
          <button
            onClick={() =>
              run(() => setTimetableStatus(ay, sem, grade, "published"))
            }
            disabled={isPending || conflicts.length > 0}
            title={conflicts.length > 0 ? "충돌을 먼저 해결하세요" : ""}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            학생에게 공개
          </button>
        )}
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            timetableStatus === "published"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {timetableStatus === "published" ? "공개됨" : "미공개"}
        </span>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>

      {conflicts.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">
            시간표 충돌 {conflicts.length}건
          </h3>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-xs text-red-600">
                {DAY_LABELS[c.day]}
                {c.period}교시 · {c.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* 밴드 목록 */}
        <div className="space-y-4">
          {bands.length === 0 && (
            <p className="text-sm text-slate-400 py-4">
              밴드를 추가하고 경합 선택과목을 배정하세요.
            </p>
          )}
          {bands.map((band) => {
            const bandOfferings = offeringsByBand.get(band.id) ?? [];
            const slots = slotsByBand.get(band.id) ?? new Set();
            const internalConflict = bandInternalConflict(bandOfferings);
            return (
              <div
                key={band.id}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {band.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {slots.size}슬롯 · {bandOfferings.length}과목
                    </span>
                    {internalConflict > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                        충돌 {internalConflict}명
                      </span>
                    )}
                  </div>
                  <ConfirmButton
                    action={() => run(() => deleteBand(band.id))}
                    question="이 밴드를 삭제할까요?"
                    confirmText="삭제"
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    삭제
                  </ConfirmButton>
                </div>

                {/* 슬롯 그리드 */}
                <div className="mb-3 overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="w-8"></th>
                        {days.map((d) => (
                          <th
                            key={d}
                            className="w-8 h-6 text-slate-400 font-normal"
                          >
                            {DAY_LABELS[d]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p}>
                          <td className="text-slate-400 text-center pr-1">
                            {p}
                          </td>
                          {days.map((d) => {
                            const on = slots.has(`${d}-${p}`);
                            return (
                              <td key={d} className="p-0.5">
                                <button
                                  onClick={() =>
                                    run(() =>
                                      toggleBandSlot(band.id, d, p, !on)
                                    )
                                  }
                                  disabled={isPending}
                                  className={`w-7 h-6 rounded ${
                                    on
                                      ? "bg-blue-500"
                                      : "bg-slate-100 hover:bg-slate-200"
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 배정된 과목 */}
                <div className="space-y-1">
                  {bandOfferings.map((o) => {
                    const sects = sectionsByOffering[o.id] ?? [];
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-slate-800">
                          {subjectsById[o.subject_id]?.name}
                          <span className="ml-1.5 text-xs text-slate-400">
                            {o.choice_group ?? ""} · {sects.length}분반 ·{" "}
                            {o.credits}학점
                          </span>
                        </span>
                        <button
                          onClick={() => run(() => setOfferingBand(o.id, null))}
                          disabled={isPending}
                          className="text-xs text-slate-400 hover:text-red-500"
                        >
                          빼기
                        </button>
                      </div>
                    );
                  })}
                  {bandOfferings.length === 0 && (
                    <p className="text-xs text-slate-400">
                      아래 미배정 과목을 이 밴드로 옮기세요.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 미배정 과목 */}
        <aside className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              미배정 선택과목
            </h3>
            {unassigned.length === 0 ? (
              <p className="text-xs text-slate-400">
                모든 선택과목이 밴드에 배정되었습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {unassigned.map((o) => (
                  <div
                    key={o.id}
                    className="border border-slate-100 rounded-lg px-2.5 py-2"
                  >
                    <div className="text-sm text-slate-800">
                      {subjectsById[o.subject_id]?.name}
                    </div>
                    <div className="text-xs text-slate-400 mb-1.5">
                      {o.choice_group ?? "단일"} · {o.credits}학점
                    </div>
                    {bands.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) =>
                          e.target.value &&
                          run(() => setOfferingBand(o.id, e.target.value))
                        }
                        disabled={isPending}
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs bg-white"
                      >
                        <option value="">밴드 선택...</option>
                        {bands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              동시수강 안내
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              같은 밴드에 넣은 과목들을 함께 수강하는 학생이 있으면
              &quot;충돌&quot;로 표시됩니다. 충돌이 0이 되도록 과목을 여러
              밴드로 나누세요.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
