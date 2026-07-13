"use client";

import { useMemo, useState, useTransition } from "react";
import type { CourseOffering, PrerequisiteRule, Subject } from "@/lib/types";
import { cancelEnrollment, enrollCourse } from "@/app/actions/enroll";

export default function EnrollForm({
  roundId,
  roundType,
  electives,
  subjectsById,
  initialSelected,
  prereqRules,
  completedSubjectIds,
  confirmedCounts,
}: {
  roundId: string;
  roundType: string;
  electives: CourseOffering[];
  subjectsById: Record<string, Subject>;
  initialSelected: Record<string, string>; // offeringId -> status
  prereqRules: PrerequisiteRule[];
  completedSubjectIds: string[];
  confirmedCounts: Record<string, number>;
}) {
  const isSurvey = roundType === "survey";
  const [selected, setSelected] = useState<Record<string, string>>(
    initialSelected
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const completed = useMemo(
    () => new Set(completedSubjectIds),
    [completedSubjectIds]
  );

  // 택1 그룹으로 묶기 (그룹명이 없으면 과목 단독 그룹)
  const groups = useMemo(() => {
    const map = new Map<string, CourseOffering[]>();
    for (const o of electives) {
      const key = o.choice_group ?? `__single_${o.id}`;
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return [...map.entries()].map(([group, offerings]) => ({
      group: group.startsWith("__single_") ? null : group,
      offerings: offerings.sort(
        (a, b) =>
          (subjectsById[a.subject_id]?.sort_order ?? 0) -
          (subjectsById[b.subject_id]?.sort_order ?? 0)
      ),
    }));
  }, [electives, subjectsById]);

  function selectedInGroup(offerings: CourseOffering[]): string | null {
    for (const o of offerings) {
      if (selected[o.id] && selected[o.id] !== "cancelled") return o.id;
    }
    return null;
  }

  function unmetRequiredPrereq(subjectId: string): boolean {
    return prereqRules.some(
      (pr) =>
        pr.subject_id === subjectId &&
        pr.enforcement === "required" &&
        !completed.has(pr.prerequisite_subject_id)
    );
  }
  function unmetRecommendedPrereq(subjectId: string): boolean {
    return prereqRules.some(
      (pr) =>
        pr.subject_id === subjectId &&
        pr.enforcement === "recommended" &&
        !completed.has(pr.prerequisite_subject_id)
    );
  }

  function handleSelect(offerings: CourseOffering[], offeringId: string) {
    const current = selectedInGroup(offerings);
    if (current === offeringId) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      if (current) {
        const c = await cancelEnrollment(roundId, current);
        if (!c.ok) {
          setError(c.reason ?? "변경 실패");
          return;
        }
      }
      const res = await enrollCourse(roundId, offeringId);
      if (!res.ok) {
        setError(res.reason ?? "신청 실패");
        setSelected((prev) => {
          const next = { ...prev };
          if (current) delete next[current];
          return next;
        });
        return;
      }
      setSelected((prev) => {
        const next = { ...prev };
        if (current) delete next[current];
        next[offeringId] = res.status ?? "confirmed";
        return next;
      });
      if (res.status === "waitlisted")
        setNotice("정원이 초과되어 대기자로 등록되었습니다.");
    });
  }

  function handleClear(offerings: CourseOffering[]) {
    const current = selectedInGroup(offerings);
    if (!current) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const c = await cancelEnrollment(roundId, current);
      if (!c.ok) {
        setError(c.reason ?? "취소 실패");
        return;
      }
      setSelected((prev) => {
        const next = { ...prev };
        delete next[current];
        return next;
      });
    });
  }

  const selectedCount = groups.filter(
    (g) => selectedInGroup(g.offerings) !== null
  ).length;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          {isSurvey
            ? "희망하는 과목을 그룹마다 하나씩 선택하세요. (수요조사)"
            : "신청할 과목을 그룹마다 하나씩 선택하세요."}
        </p>
        <span className="text-sm text-slate-500">
          {selectedCount} / {groups.length} 그룹 선택됨
        </span>
      </div>

      {selectedCount < groups.length && (
        <div className="mb-4 text-sm rounded-lg bg-amber-50 text-amber-700 px-3 py-2">
          아직 선택하지 않은 그룹이 {groups.length - selectedCount}개 있습니다.
          마감 전까지 모든 그룹에서 한 과목씩 선택하세요.
        </div>
      )}
      {selectedCount === groups.length && groups.length > 0 && (
        <div className="mb-4 text-sm rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2">
          모든 그룹을 선택했습니다.
        </div>
      )}
      {error && (
        <div className="mb-4 text-sm rounded-lg bg-red-50 text-red-700 px-3 py-2">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 text-sm rounded-lg bg-amber-50 text-amber-700 px-3 py-2">
          {notice}
        </div>
      )}

      <div className="space-y-5">
        {groups.map(({ group, offerings }, gi) => {
          const chosen = selectedInGroup(offerings);
          return (
            <div
              key={group ?? offerings[0].id}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {group ?? `선택 ${gi + 1}`}
                  {chosen && (
                    <span className="ml-2 text-xs text-emerald-600 font-normal">
                      선택됨
                    </span>
                  )}
                </h3>
                {chosen && (
                  <button
                    onClick={() => handleClear(offerings)}
                    disabled={isPending}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    선택 취소
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {offerings.map((o) => {
                  const subject = subjectsById[o.subject_id];
                  const isChosen = chosen === o.id;
                  const status = selected[o.id];
                  const reqUnmet = unmetRequiredPrereq(o.subject_id);
                  const recUnmet = unmetRecommendedPrereq(o.subject_id);
                  const remaining = !isSurvey
                    ? o.capacity - (confirmedCounts[o.id] ?? 0)
                    : null;
                  const full = remaining !== null && remaining <= 0;

                  return (
                    <button
                      key={o.id}
                      onClick={() => handleSelect(offerings, o.id)}
                      disabled={isPending || (reqUnmet && !isSurvey)}
                      className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        isChosen
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      } ${reqUnmet && !isSurvey ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">
                          {subject?.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {o.credits}학점
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isChosen && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              status === "waitlisted"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {status === "waitlisted"
                              ? "대기"
                              : isSurvey
                                ? "신청됨"
                                : "확정"}
                          </span>
                        )}
                        {remaining !== null && (
                          <span
                            className={`text-xs ${full ? "text-amber-600" : "text-slate-400"}`}
                          >
                            {full ? "정원 마감 (대기 가능)" : `잔여 ${remaining}석`}
                          </span>
                        )}
                        {reqUnmet && (
                          <span className="text-xs text-red-600">
                            선수과목 미이수
                          </span>
                        )}
                        {!reqUnmet && recUnmet && (
                          <span className="text-xs text-amber-600">
                            선수과목 권장
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        선택 즉시 저장됩니다. 마감 전까지 언제든 변경할 수 있습니다.
      </p>
    </div>
  );
}
