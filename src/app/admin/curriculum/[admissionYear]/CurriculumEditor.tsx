"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  CurriculumEntry,
  CurriculumPlan,
  PrerequisiteRule,
  SchoolSettings,
  Subject,
} from "@/lib/types";
import {
  validateCurriculum,
  type EntryInput,
} from "@/lib/validation/curriculum";
import { SEMESTERS } from "@/lib/validation/curriculum-rules";
import {
  confirmPlan,
  saveCurriculum,
  unconfirmPlan,
} from "@/app/actions/curriculum";
import ConfirmButton from "@/components/ConfirmButton";

type LocalEntry = EntryInput & { key: string };

const cellKey = (subjectId: string, grade: number, semester: number) =>
  `${subjectId}-${grade}-${semester}`;

const TYPE_ORDER = ["공통", "일반선택", "진로선택", "융합선택", "창체"];

export default function CurriculumEditor({
  plan,
  initialEntries,
  subjects,
  settings,
  prereqRules,
}: {
  plan: CurriculumPlan;
  initialEntries: CurriculumEntry[];
  subjects: Subject[];
  settings: SchoolSettings;
  prereqRules: PrerequisiteRule[];
}) {
  const subjectsById = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const [entries, setEntries] = useState<LocalEntry[]>(() =>
    initialEntries.map((e) => ({
      key: cellKey(e.subject_id, e.grade, e.semester),
      subject_id: e.subject_id,
      grade: e.grade,
      semester: e.semester,
      credits: e.credits,
      is_required: e.is_required,
      choice_group: e.choice_group,
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(plan.status);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const readOnly = status === "confirmed";

  const { issues, summary } = useMemo(
    () =>
      validateCurriculum({
        entries,
        subjectsById,
        settings,
        prereqRules,
      }),
    [entries, subjectsById, settings, prereqRules]
  );

  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.filter((i) => i.level === "warn").length;

  function mutate(next: LocalEntry[]) {
    setEntries(next);
    setDirty(true);
    setMessage(null);
  }

  function addSubject(grade: number, semester: number, subjectId: string) {
    if (!subjectId) return;
    const key = cellKey(subjectId, grade, semester);
    if (entries.some((e) => e.key === key)) return;
    const subject = subjectsById[subjectId];
    mutate([
      ...entries,
      {
        key,
        subject_id: subjectId,
        grade,
        semester,
        credits: subject.default_credits,
        is_required: subject.subject_type === "공통" || subject.subject_group === "창의적체험활동",
        choice_group: null,
      },
    ]);
  }

  function updateEntry(key: string, patch: Partial<LocalEntry>) {
    mutate(entries.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function removeEntry(key: string) {
    mutate(entries.filter((e) => e.key !== key));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveCurriculum(
        plan.id,
        entries.map(({ key: _key, ...e }) => e)
      );
      if (result.ok) {
        setDirty(false);
        setMessage("저장되었습니다.");
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      if (dirty) {
        const saved = await saveCurriculum(
          plan.id,
          entries.map(({ key: _key, ...e }) => e)
        );
        if (!saved.ok) {
          setMessage(saved.message);
          return;
        }
        setDirty(false);
      }
      const result = await confirmPlan(plan.id);
      if (result.ok) {
        setStatus("confirmed");
        setMessage("편제표가 확정되었습니다.");
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleUnconfirm() {
    startTransition(async () => {
      const result = await unconfirmPlan(plan.id);
      if (result.ok) {
        setStatus("draft");
        setMessage("확정이 해제되었습니다. 이제 수정할 수 있습니다.");
      } else {
        setMessage(result.message ?? "확정 해제 실패");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      {/* 메인 편집 영역 */}
      <div>
        <div className="flex items-center justify-between mb-4 print:mb-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {plan.admission_year}학년도 입학생 편제표
            </h1>
            <p className="text-sm text-slate-500">
              학생 1인의 이수 경로 기준 · 총 {summary.totalCredits}학점
              {status === "confirmed" && (
                <span className="ml-2 text-emerald-600 font-medium">
                  확정됨
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              인쇄
            </button>
            {!readOnly ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isPending || !dirty}
                  className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                >
                  {dirty ? "저장" : "저장됨"}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending || errorCount > 0}
                  title={errorCount > 0 ? "규정 오류를 먼저 해결하세요" : ""}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  확정
                </button>
              </>
            ) : (
              <ConfirmButton
                action={handleUnconfirm}
                question="확정을 해제할까요?"
                confirmText="해제"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                확정 해제
              </ConfirmButton>
            )}
          </div>
        </div>

        {message && (
          <div className="mb-4 text-sm rounded-lg bg-slate-100 text-slate-700 px-3 py-2 print:hidden">
            {message}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {SEMESTERS.map(({ grade, semester }) => {
            const cellEntries = entries
              .filter((e) => e.grade === grade && e.semester === semester)
              .sort(
                (a, b) =>
                  (subjectsById[a.subject_id]?.sort_order ?? 0) -
                  (subjectsById[b.subject_id]?.sort_order ?? 0)
              );
            const cellCredits = summary.semesters.find(
              (s) => s.grade === grade && s.semester === semester
            );
            return (
              <SemesterCell
                key={`${grade}-${semester}`}
                grade={grade}
                semester={semester}
                entries={cellEntries}
                subjects={subjects}
                subjectsById={subjectsById}
                readOnly={readOnly}
                studentCredits={cellCredits?.studentCredits ?? 0}
                studentSubjectCount={cellCredits?.studentSubjectCount ?? 0}
                onAdd={addSubject}
                onUpdate={updateEntry}
                onRemove={removeEntry}
              />
            );
          })}
        </div>
      </div>

      {/* 검증 패널 (사이드바) */}
      <aside className="lg:sticky lg:top-20 self-start space-y-4 print:hidden">
        <SummaryPanel summary={summary} />
        <IssuePanel
          issues={issues}
          errorCount={errorCount}
          warnCount={warnCount}
        />
      </aside>
    </div>
  );
}

function SemesterCell({
  grade,
  semester,
  entries,
  subjects,
  subjectsById,
  readOnly,
  studentCredits,
  studentSubjectCount,
  onAdd,
  onUpdate,
  onRemove,
}: {
  grade: number;
  semester: number;
  entries: LocalEntry[];
  subjects: Subject[];
  subjectsById: Record<string, Subject>;
  readOnly: boolean;
  studentCredits: number;
  studentSubjectCount: number;
  onAdd: (grade: number, semester: number, subjectId: string) => void;
  onUpdate: (key: string, patch: Partial<LocalEntry>) => void;
  onRemove: (key: string) => void;
}) {
  const [picker, setPicker] = useState("");

  const grouped = useMemo(() => {
    const byType = new Map<string, Subject[]>();
    for (const s of subjects) {
      const list = byType.get(s.subject_type) ?? [];
      list.push(s);
      byType.set(s.subject_type, list);
    }
    return TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      type: t,
      subjects: byType.get(t)!,
    }));
  }, [subjects]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 break-inside-avoid">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">
          {grade}학년 {semester}학기
        </h3>
        <span className="text-xs text-slate-500">
          {studentCredits}학점 · {studentSubjectCount}과목
        </span>
      </div>

      <div className="space-y-1.5">
        {entries.length === 0 && (
          <p className="text-xs text-slate-400 py-2">편성된 과목이 없습니다.</p>
        )}
        {entries.map((e) => {
          const subject = subjectsById[e.subject_id];
          return (
            <div
              key={e.key}
              className="flex items-center gap-1.5 text-sm border border-slate-100 rounded-lg px-2 py-1.5"
            >
              <span className="flex-1 truncate text-slate-800" title={subject?.name}>
                {subject?.name}
              </span>

              {!readOnly ? (
                <>
                  <input
                    type="number"
                    value={e.credits}
                    min={subject?.min_credits}
                    max={subject?.max_credits}
                    onChange={(ev) =>
                      onUpdate(e.key, { credits: Number(ev.target.value) })
                    }
                    className="w-11 rounded border border-slate-200 px-1 py-0.5 text-xs text-center"
                  />
                  <select
                    value={e.is_required ? "req" : e.choice_group ? "choice" : "none"}
                    onChange={(ev) => {
                      const v = ev.target.value;
                      if (v === "req")
                        onUpdate(e.key, { is_required: true, choice_group: null });
                      else if (v === "choice")
                        onUpdate(e.key, {
                          is_required: false,
                          choice_group: e.choice_group || "택1",
                        });
                      else
                        onUpdate(e.key, { is_required: false, choice_group: null });
                    }}
                    className="rounded border border-slate-200 px-1 py-0.5 text-xs bg-white"
                  >
                    <option value="req">지정</option>
                    <option value="choice">택1</option>
                    <option value="none">미분류</option>
                  </select>
                  {!e.is_required && e.choice_group !== null && (
                    <input
                      type="text"
                      value={e.choice_group}
                      onChange={(ev) =>
                        onUpdate(e.key, { choice_group: ev.target.value })
                      }
                      placeholder="그룹명"
                      className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                    />
                  )}
                  <button
                    onClick={() => onRemove(e.key)}
                    className="text-slate-300 hover:text-red-500 px-1"
                    title="삭제"
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-500">
                  {e.credits}학점
                  {e.is_required
                    ? " · 지정"
                    : e.choice_group
                      ? ` · ${e.choice_group}`
                      : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-3 print:hidden">
          <select
            value={picker}
            onChange={(ev) => {
              onAdd(grade, semester, ev.target.value);
              setPicker("");
            }}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 bg-slate-50"
          >
            <option value="">＋ 과목 추가...</option>
            {grouped.map((g) => (
              <optgroup key={g.type} label={g.type}>
                {g.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.subject_group})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function SummaryPanel({
  summary,
}: {
  summary: ReturnType<typeof validateCurriculum>["summary"];
}) {
  const rows: Array<[string, string, boolean?]> = [
    ["총 이수 학점", `${summary.totalCredits} / 192`, summary.totalCredits === 192],
    ["교과", `${summary.subjectCredits} / 174`, summary.subjectCredits === 174],
    ["창의적 체험활동", `${summary.ccaCredits} / 18`, summary.ccaCredits === 18],
    [
      "국·수·영 합계",
      `${summary.korMatEngCredits} / 81↓`,
      summary.korMatEngCredits <= 81,
    ],
    ["한국사", `${summary.koreanHistoryCredits} / 6`, summary.koreanHistoryCredits >= 6],
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm">학점 집계</h3>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value, ok]) => (
          <div key={label} className="flex items-center justify-between">
            <dt className="text-slate-500">{label}</dt>
            <dd
              className={`font-medium tabular-nums ${
                ok === undefined
                  ? "text-slate-700"
                  : ok
                    ? "text-emerald-600"
                    : "text-red-600"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <h4 className="font-medium text-slate-600 mt-4 mb-2 text-xs">
        교과(군)별 이수
      </h4>
      <div className="space-y-1 text-xs">
        {summary.groups
          .filter((g) => g.group !== "창의적체험활동")
          .map((g) => (
            <div key={g.group} className="flex items-center justify-between">
              <span className="text-slate-500">{g.group}</span>
              <span
                className={`tabular-nums ${
                  g.requiredMin != null && g.studentCredits < g.requiredMin
                    ? "text-red-600 font-medium"
                    : "text-slate-700"
                }`}
              >
                {g.studentCredits}
                {g.requiredMin != null && ` / ${g.requiredMin}`}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function IssuePanel({
  issues,
  errorCount,
  warnCount,
}: {
  issues: ReturnType<typeof validateCurriculum>["issues"];
  errorCount: number;
  warnCount: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-2">
        규정 검증
        {errorCount === 0 && warnCount === 0 ? (
          <span className="text-xs text-emerald-600 font-normal">
            통과 ✓
          </span>
        ) : (
          <span className="text-xs font-normal">
            {errorCount > 0 && (
              <span className="text-red-600">오류 {errorCount}</span>
            )}
            {errorCount > 0 && warnCount > 0 && " · "}
            {warnCount > 0 && (
              <span className="text-amber-600">경고 {warnCount}</span>
            )}
          </span>
        )}
      </h3>

      {issues.length === 0 ? (
        <p className="text-xs text-slate-400">
          모든 규정을 만족합니다. 확정할 수 있습니다.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-96 overflow-y-auto">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={`text-xs leading-snug rounded-lg px-2 py-1.5 ${
                issue.level === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
