import { createClient } from "@/lib/supabase/server";

type CreditRow = {
  student_id: string;
  credits: number;
  subject_name: string;
  subject_type: string;
  attendance_ok: boolean;
  achievement_pct: number | null;
  result: string;
};

export default async function ProgressPage() {
  const supabase = await createClient();

  const [{ data: credits }, { data: students }] = await Promise.all([
    supabase.from("v_student_credits").select("*"),
    supabase
      .from("students")
      .select("id, student_no, grade, class_no, number, profiles(name)")
      .eq("status", "재학"),
  ]);

  const nameById = new Map<string, string>();
  const locById = new Map<string, string>();
  for (const s of (students ?? []) as Array<{
    id: string;
    student_no: string;
    grade: number | null;
    class_no: number | null;
    number: number | null;
    profiles: { name: string } | { name: string }[] | null;
  }>) {
    const p = s.profiles;
    const name = Array.isArray(p) ? p[0]?.name : p?.name;
    nameById.set(s.id, name ?? s.student_no);
    locById.set(
      s.id,
      s.grade ? `${s.grade}-${s.class_no}-${s.number}` : s.student_no
    );
  }

  const rows = (credits ?? []) as CreditRow[];
  const notMet = rows.filter((r) => r.result === "not_met");
  const notMetByStudent = new Map<string, CreditRow[]>();
  for (const r of notMet) {
    const list = notMetByStudent.get(r.student_id) ?? [];
    list.push(r);
    notMetByStudent.set(r.student_id, list);
  }

  const graded = rows.filter((r) => r.result !== "in_progress").length;
  const passed = rows.filter((r) => r.result === "passed").length;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">이수 현황 · 미이수 관리</h1>
      <p className="mt-1 text-sm text-slate-500">
        최소 성취수준 미도달(미이수) 학생을 추적합니다. 미이수는 보충지도
        대상입니다.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="성적 입력 완료" value={`${graded}건`} />
        <Stat label="이수" value={`${passed}건`} tone="emerald" />
        <Stat label="미이수" value={`${notMet.length}건`} tone="red" />
      </div>

      <h2 className="mt-8 font-semibold text-slate-800 mb-3">
        미이수 학생 {notMetByStudent.size}명
      </h2>
      {notMetByStudent.size === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          미이수 대상이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">학생</th>
                <th className="px-4 py-2">미이수 과목</th>
              </tr>
            </thead>
            <tbody>
              {[...notMetByStudent.entries()].map(([sid, list]) => (
                <tr key={sid} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                    {nameById.get(sid)}
                    <span className="ml-1.5 text-xs text-slate-400">
                      {locById.get(sid)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((r, i) => (
                        <span
                          key={i}
                          className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded"
                        >
                          {r.subject_name}
                          {r.subject_type === "공통" &&
                            r.achievement_pct != null &&
                            r.achievement_pct < 40 &&
                            ` (성취율 ${r.achievement_pct}%)`}
                          {!r.attendance_ok && " (출석미달)"}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "red";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "emerald"
            ? "text-emerald-600"
            : tone === "red"
              ? "text-red-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
