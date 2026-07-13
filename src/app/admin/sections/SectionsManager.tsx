"use client";

import { useMemo, useState, useTransition } from "react";
import type { CourseOffering, Room, Section, Subject } from "@/lib/types";
import {
  assignSectionRoom,
  assignSectionTeacher,
  autoAssignRooms,
  autoSection,
} from "@/app/actions/sections";

type Teacher = { id: string; name: string; subject_group: string };

export default function SectionsManager({
  offerings,
  sections,
  subjectsById,
  rooms,
  teachers,
  confirmedByOffering,
  confirmedBySection,
  scopes,
}: {
  offerings: CourseOffering[];
  sections: Section[];
  subjectsById: Record<string, Subject>;
  rooms: Room[];
  teachers: Teacher[];
  confirmedByOffering: Record<string, number>;
  confirmedBySection: Record<string, number>;
  scopes: string[];
}) {
  const [scope, setScope] = useState(scopes[0] ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [ay, sem, grade] = scope
    ? scope.split("-").map(Number)
    : [0, 0, 0];

  const sectionsByOffering = useMemo(() => {
    const map = new Map<string, Section[]>();
    for (const s of sections) {
      const list = map.get(s.offering_id) ?? [];
      list.push(s);
      map.set(s.offering_id, list);
    }
    return map;
  }, [sections]);

  const scopeOfferings = offerings
    .filter((o) => `${o.academic_year}-${o.semester}-${o.grade}` === scope)
    .sort((a, b) => {
      const ga = a.choice_group ?? "";
      const gb = b.choice_group ?? "";
      if (ga !== gb) return ga.localeCompare(gb, "ko");
      return (
        (subjectsById[a.subject_id]?.sort_order ?? 0) -
        (subjectsById[b.subject_id]?.sort_order ?? 0)
      );
    });

  function handleAuto() {
    const fd = new FormData();
    fd.set("academic_year", String(ay));
    fd.set("semester", String(sem));
    fd.set("grade", String(grade));
    startTransition(async () => {
      const r = await autoSection(fd);
      setMessage(r.message);
    });
  }

  if (scopes.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900">분반 · 강의실 배정</h1>
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          확정된 수강신청 인원이 없습니다. 먼저 정식 수강신청을 마감하세요.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            분반 · 강의실 배정
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            확정 인원을 분반으로 나누고 담당 교사·강의실을 지정합니다.
          </p>
        </div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
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
          onClick={handleAuto}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {isPending ? "배정 중..." : "자동 분반 배정"}
        </button>
        <button
          onClick={() => {
            const fd = new FormData();
            fd.set("academic_year", String(ay));
            fd.set("semester", String(sem));
            fd.set("grade", String(grade));
            startTransition(async () => {
              const r = await autoAssignRooms(fd);
              setMessage(r.message);
            });
          }}
          disabled={isPending}
          className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
        >
          강의실 일괄 배정
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>

      <div className="space-y-4">
        {scopeOfferings.map((off) => {
          const subject = subjectsById[off.subject_id];
          const offSections = (sectionsByOffering.get(off.id) ?? []).sort(
            (a, b) => a.section_no - b.section_no
          );
          const total = confirmedByOffering[off.id] ?? 0;
          return (
            <div
              key={off.id}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-slate-900">
                    {subject?.name}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {off.choice_group ?? "단일"} · {subject?.subject_group} ·{" "}
                    {off.credits}학점
                  </span>
                </div>
                <span className="text-sm text-slate-500">
                  확정 {total}명 · 분반 {offSections.length}개
                </span>
              </div>

              {offSections.length === 0 ? (
                <p className="text-xs text-slate-400">
                  아직 분반이 없습니다. 위 &quot;자동 분반 배정&quot;을
                  실행하세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {offSections.map((sec) => (
                    <SectionRow
                      key={sec.id}
                      section={sec}
                      subjectGroup={subject?.subject_group ?? ""}
                      studentCount={confirmedBySection[sec.id] ?? 0}
                      teachers={teachers}
                      rooms={rooms}
                      isPending={isPending}
                      onTeacher={(tid) =>
                        startTransition(() =>
                          assignSectionTeacher(sec.id, tid)
                        )
                      }
                      onRoom={(rid) =>
                        startTransition(() => assignSectionRoom(sec.id, rid))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionRow({
  section,
  subjectGroup,
  studentCount,
  teachers,
  rooms,
  isPending,
  onTeacher,
  onRoom,
}: {
  section: Section;
  subjectGroup: string;
  studentCount: number;
  teachers: Teacher[];
  rooms: Room[];
  isPending: boolean;
  onTeacher: (id: string | null) => void;
  onRoom: (id: string | null) => void;
}) {
  // 같은 교과(군) 교사·강의실을 먼저 노출
  const sortedTeachers = [...teachers].sort((a, b) => {
    const am = a.subject_group === subjectGroup ? 0 : 1;
    const bm = b.subject_group === subjectGroup ? 0 : 1;
    return am - bm;
  });
  const sortedRooms = [...rooms].sort((a, b) => {
    const am = a.subject_group === subjectGroup ? 0 : 1;
    const bm = b.subject_group === subjectGroup ? 0 : 1;
    return am - bm;
  });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
      <span className="font-medium text-slate-700 w-16">
        {section.section_no}분반
      </span>
      <span className="text-xs text-slate-400 w-14">{studentCount}명</span>

      <label className="text-xs text-slate-400">교사</label>
      <select
        value={section.teacher_id ?? ""}
        onChange={(e) => onTeacher(e.target.value || null)}
        disabled={isPending}
        className="rounded border border-slate-200 px-2 py-1 text-xs bg-white min-w-28"
      >
        <option value="">미지정</option>
        {sortedTeachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.subject_group ? ` (${t.subject_group})` : ""}
          </option>
        ))}
      </select>

      <label className="text-xs text-slate-400">강의실</label>
      <select
        value={section.room_id ?? ""}
        onChange={(e) => onRoom(e.target.value || null)}
        disabled={isPending}
        className="rounded border border-slate-200 px-2 py-1 text-xs bg-white min-w-32"
      >
        <option value="">미지정</option>
        {sortedRooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.subject_group ? ` (${r.subject_group})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
