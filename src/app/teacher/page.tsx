import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export default async function TeacherDashboard() {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("subject_group")
    .eq("id", profile!.id)
    .single();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">
        {profile!.name} 선생님, 안녕하세요
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {teacher?.subject_group
          ? `담당 교과: ${teacher.subject_group}`
          : "담당 교과가 아직 지정되지 않았습니다."}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
        담당 분반 명단과 시간표는 분반·시간표 편성이 완료되면 여기에
        표시됩니다. (Phase 4~5)
      </div>
    </div>
  );
}
