import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { DAY_LABELS } from "@/lib/timetable/conflicts";

type Slot = {
  academic_year: number;
  semester: number;
  grade: number;
  day: number;
  period: number;
  subject_name: string;
  section_no: number;
  room_name: string | null;
  teacher_name: string | null;
};

export default async function StudentTimetablePage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("periods_per_day, days_per_week")
    .eq("id", 1)
    .single();

  const { data: slotRows } = await supabase
    .from("v_student_timetable")
    .select("*")
    .eq("student_id", profile!.id);

  const allSlots = (slotRows ?? []) as Slot[];

  // 공개된 시간표만 노출
  const { data: published } = await supabase
    .from("timetables")
    .select("academic_year, semester, grade")
    .eq("status", "published");
  const publishedSet = new Set(
    (published ?? []).map(
      (t) => `${t.academic_year}-${t.semester}-${t.grade}`
    )
  );
  const slots = allSlots.filter((s) =>
    publishedSet.has(`${s.academic_year}-${s.semester}-${s.grade}`)
  );

  const daysPerWeek = settings?.days_per_week ?? 5;
  const periodsPerDay = settings?.periods_per_day ?? 7;
  const days = Array.from({ length: daysPerWeek }, (_, i) => i + 1);
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const bySlot = new Map<string, Slot>();
  for (const s of slots) bySlot.set(`${s.day}-${s.period}`, s);

  return (
    <div>
      <div className="mb-4">
        <Link href="/student" className="text-sm text-slate-500 hover:text-slate-700">
          ← 홈
        </Link>
      </div>
      <h1 className="text-xl font-bold text-slate-900">내 시간표</h1>
      <p className="mt-1 text-sm text-slate-500">
        공개된 시간표의 수업 배치입니다. (지정·선택과목 포함)
      </p>

      {slots.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          아직 공개된 시간표가 없습니다.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[560px]">
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
                    const s = bySlot.get(`${d}-${p}`);
                    return (
                      <td
                        key={d}
                        className="border border-slate-200 p-1.5 align-top h-16"
                      >
                        {s && (
                          <div className="rounded-lg bg-blue-50 px-2 py-1.5">
                            <div className="font-medium text-slate-800 text-xs">
                              {s.subject_name}
                            </div>
                            {s.room_name && (
                              <div className="text-xs text-blue-700 mt-0.5">
                                {s.room_name}
                              </div>
                            )}
                            {s.teacher_name && (
                              <div className="text-xs text-slate-400">
                                {s.teacher_name}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
