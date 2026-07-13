import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type Assignment = {
  academic_year: number;
  semester: number;
  subject_name: string;
  subject_group: string;
  credits: number;
  choice_group: string | null;
  section_no: number | null;
  room_name: string | null;
  teacher_name: string | null;
};

export default async function StudentRoomsPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_student_assignment")
    .select("*")
    .eq("student_id", profile!.id)
    .order("academic_year")
    .order("semester");

  const rows = (data ?? []) as Assignment[];

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link
          href="/student"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 홈
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900">내 수강 과목 · 강의실</h1>
      <p className="mt-1 text-sm text-slate-500">
        확정된 수강 과목과 배정된 강의실입니다.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          아직 확정된 수강 과목이 없습니다. 수강신청이 마감되고 분반이 배정되면
          여기에 표시됩니다.
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">과목</th>
                <th className="px-4 py-2">교과(군)</th>
                <th className="px-4 py-2">담당 교사</th>
                <th className="px-4 py-2">강의실</th>
                <th className="px-4 py-2">분반</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {r.subject_name}
                    <span className="ml-1.5 text-xs text-slate-400">
                      {r.credits}학점
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.subject_group}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.teacher_name ?? "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.room_name ? (
                      <span className="font-medium text-blue-700">
                        {r.room_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">미배정</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {r.section_no ? `${r.section_no}분반` : "-"}
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
