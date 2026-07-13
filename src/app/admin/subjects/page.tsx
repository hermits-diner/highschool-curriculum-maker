import {
  addCustomSubject,
  addPrereqRule,
  deleteCustomSubject,
  deletePrereqRule,
} from "@/app/actions/admin-basics";
import { createClient } from "@/lib/supabase/server";
import type { Subject } from "@/lib/types";
import ConfirmButton from "@/components/ConfirmButton";

const GROUPS = [
  "국어",
  "수학",
  "영어",
  "사회",
  "과학",
  "체육",
  "예술",
  "기술·가정",
  "정보",
  "제2외국어",
  "한문",
  "교양",
  "창의적체험활동",
];

const TYPE_BADGE: Record<string, string> = {
  공통: "bg-blue-50 text-blue-700",
  일반선택: "bg-emerald-50 text-emerald-700",
  진로선택: "bg-amber-50 text-amber-700",
  융합선택: "bg-purple-50 text-purple-700",
  창체: "bg-slate-100 text-slate-600",
};

export default async function SubjectsPage() {
  const supabase = await createClient();
  const [{ data: subjectsData }, { data: rulesData }] = await Promise.all([
    supabase.from("subjects").select("*").order("sort_order"),
    supabase
      .from("prerequisite_rules")
      .select(
        "id, enforcement, subject:subjects!prerequisite_rules_subject_id_fkey(id, name), prerequisite:subjects!prerequisite_rules_prerequisite_subject_id_fkey(id, name)"
      ),
  ]);

  const subjects = (subjectsData ?? []) as Subject[];
  const rules = (rulesData ?? []) as unknown as Array<{
    id: string;
    enforcement: string;
    subject: { id: string; name: string };
    prerequisite: { id: string; name: string };
  }>;

  const byGroup = new Map<string, Subject[]>();
  for (const s of subjects) {
    const list = byGroup.get(s.subject_group) ?? [];
    list.push(s);
    byGroup.set(s.subject_group, list);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">과목 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          2022 개정교육과정 보통교과 {subjects.filter((s) => !s.is_custom).length}
          과목이 등록되어 있습니다. 학교 신설 과목을 추가할 수 있습니다.
        </p>
      </div>

      {/* 신규 과목 추가 */}
      <form
        action={addCustomSubject}
        className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            과목명
          </label>
          <input
            name="name"
            required
            placeholder="학교 신설 과목명"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            교과(군)
          </label>
          <select
            name="subject_group"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            {GROUPS.filter((g) => g !== "창의적체험활동").map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            유형
          </label>
          <select
            name="subject_type"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option>일반선택</option>
            <option>진로선택</option>
            <option>융합선택</option>
          </select>
        </div>
        {[
          ["credits", "기본", 4],
          ["min_credits", "최소", 3],
          ["max_credits", "최대", 5],
        ].map(([name, label, def]) => (
          <div key={String(name)} className="w-16">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {label}학점
            </label>
            <input
              name={String(name)}
              type="number"
              defaultValue={Number(def)}
              min={1}
              max={8}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
        ))}
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          과목 추가
        </button>
      </form>

      {/* 과목 목록 */}
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const list = byGroup.get(group);
          if (!list?.length) return null;
          return (
            <div key={group}>
              <h2 className="font-semibold text-slate-800 mb-2">
                {group}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {list.length}과목
                </span>
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {s.name}
                          {s.is_custom && (
                            <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                              학교 신설
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 w-24">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGE[s.subject_type] ?? ""}`}
                          >
                            {s.subject_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 w-36 text-slate-500">
                          {s.default_credits}학점
                          <span className="text-xs text-slate-400 ml-1">
                            ({s.min_credits}~{s.max_credits})
                          </span>
                        </td>
                        <td className="px-2 py-2 w-16 text-right">
                          {s.is_custom && (
                            <ConfirmButton
                              action={deleteCustomSubject.bind(null, s.id)}
                              question="삭제할까요?"
                              confirmText="삭제"
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              삭제
                            </ConfirmButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* 선수과목 규칙 */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-1">
          선수과목(위계) 규칙
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          「대상 과목」은 「선수과목」 이수 후 수강·편성할 수 있습니다.
          필수(차단)는 편제·수강신청에서 오류, 권장은 경고로 처리됩니다.
        </p>

        <form
          action={addPrereqRule}
          className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 mb-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              대상 과목
            </label>
            <select
              name="subject_id"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-52"
            >
              {subjects
                .filter((s) => s.subject_group !== "창의적체험활동")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              선수과목
            </label>
            <select
              name="prerequisite_subject_id"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-52"
            >
              {subjects
                .filter((s) => s.subject_group !== "창의적체험활동")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              강제성
            </label>
            <select
              name="enforcement"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="required">필수 (차단)</option>
              <option value="recommended">권장 (경고)</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            규칙 추가
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">대상 과목</th>
                <th className="px-4 py-2">선수과목</th>
                <th className="px-4 py-2 w-28">강제성</th>
                <th className="px-2 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.subject?.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.prerequisite?.name}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.enforcement === "required"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.enforcement === "required" ? "필수" : "권장"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <ConfirmButton
                      action={deletePrereqRule.bind(null, r.id)}
                      question="삭제할까요?"
                      confirmText="삭제"
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      삭제
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
