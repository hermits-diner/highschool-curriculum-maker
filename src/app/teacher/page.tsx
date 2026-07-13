import Link from "next/link";
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

  // 담당 분반 수
  const { count } = await supabase
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", profile!.id);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ink)]">
          {profile!.name} 선생님, 안녕하세요
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {teacher?.subject_group
            ? `담당 교과 · ${teacher.subject_group}`
            : "담당 교과가 아직 지정되지 않았습니다."}
        </p>
      </header>

      <Link
        href="/teacher/sections"
        className="group block card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
              담당 분반 명단 · 성적
              {count != null && count > 0 && (
                <span className="badge badge-accent">{count}개 분반</span>
              )}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
              담당 분반의 수강 학생 명단을 확인하고, 이수 성적(출석·성취율)을
              입력합니다.
            </p>
          </div>
          <span className="text-[var(--faint)] text-lg transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
      </Link>
    </div>
  );
}
