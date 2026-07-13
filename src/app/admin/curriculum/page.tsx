import Link from "next/link";
import { copyCurriculumPlan, createPlan } from "@/app/actions/curriculum";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumPlan } from "@/lib/types";
import ConfirmButton from "@/components/ConfirmButton";

export default async function CurriculumListPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("curriculum_plans")
    .select("*")
    .order("admission_year", { ascending: false });
  const plans = (data ?? []) as CurriculumPlan[];
  const nextYear = new Date().getFullYear() + 1;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">편제표</h1>
      <p className="mt-1 text-sm text-slate-500">
        입학년도별 3개년 교육과정 편제표를 작성합니다. 해당 연도 입학생이 3년간
        이수할 과목과 학점을 배치하세요.
      </p>

      <form
        action={createPlan}
        className="mt-6 flex items-end gap-3 bg-white rounded-xl border border-slate-200 p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            입학년도
          </label>
          <input
            name="admission_year"
            type="number"
            defaultValue={nextYear}
            min={2020}
            max={2100}
            required
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          새 편제표 만들기
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {plans.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">
            아직 편제표가 없습니다. 위에서 입학년도를 입력해 만들어보세요.
          </p>
        )}
        {plans.map((p) => {
          const nextYear = p.admission_year + 1;
          const nextExists = plans.some((x) => x.admission_year === nextYear);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-blue-400 transition-colors"
            >
              <Link
                href={`/admin/curriculum/${p.admission_year}`}
                className="flex-1 min-w-0"
              >
                <span className="font-semibold text-slate-900">
                  {p.admission_year}학년도 입학생 편제표
                </span>
                <span className="ml-3 text-xs text-slate-400">
                  {p.admission_year}~{p.admission_year + 2}학년도 운영
                </span>
              </Link>
              <div className="flex items-center gap-3">
                {!nextExists && (
                  <ConfirmButton
                    action={copyCurriculumPlan.bind(null, p.admission_year, nextYear)}
                    question={`${nextYear}학년도로 복제할까요?`}
                    confirmText="복제"
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {nextYear}학년도 복제
                  </ConfirmButton>
                )}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    p.status === "confirmed"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {p.status === "confirmed" ? "확정" : "작성 중"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
