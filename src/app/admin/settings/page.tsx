import { createClient } from "@/lib/supabase/server";
import { updateSettings } from "@/app/actions/admin-basics";

const FIELDS: Array<{
  name: string;
  label: string;
  hint?: string;
}> = [
  { name: "classes_per_grade", label: "학년당 학급 수" },
  { name: "min_credits_per_semester", label: "학기당 최소 이수 학점" },
  { name: "max_credits_per_semester", label: "학기당 최대 이수 학점" },
  {
    name: "max_subjects_per_semester",
    label: "학기당 최대 이수 과목 수",
    hint: "비워두면 검사하지 않음",
  },
  { name: "min_students_to_open", label: "과목 개설 최소 인원 (폐강 기준)" },
  { name: "default_section_capacity", label: "분반 기본 정원" },
  { name: "periods_per_day", label: "1일 교시 수" },
  { name: "days_per_week", label: "주당 수업 일수" },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("school_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const s = settings as Record<string, unknown>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">학교 설정</h1>
      <p className="mt-1 text-sm text-slate-500">
        편성 검증과 수강신청에 사용되는 학교별 파라미터입니다. 시도교육청
        지침과 학교 규정에 맞게 조정하세요.
      </p>

      <form
        action={updateSettings}
        className="mt-8 bg-white rounded-xl border border-slate-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            학교명
          </label>
          <input
            name="school_name"
            defaultValue={String(s.school_name ?? "")}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {f.label}
              </label>
              <input
                name={f.name}
                type="number"
                defaultValue={s[f.name] == null ? "" : Number(s[f.name])}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {f.hint && (
                <p className="mt-1 text-xs text-slate-400">{f.hint}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          저장
        </button>
      </form>
    </div>
  );
}
