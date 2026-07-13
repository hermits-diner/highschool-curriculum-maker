import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type {
  CourseOffering,
  EnrollmentRound,
  PrerequisiteRule,
  Subject,
} from "@/lib/types";
import EnrollForm from "./EnrollForm";

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: round } = await supabase
    .from("enrollment_rounds")
    .select("*")
    .eq("id", roundId)
    .single();
  if (!round) notFound();
  const r = round as EnrollmentRound;

  const { data: student } = await supabase
    .from("students")
    .select("grade, admission_year")
    .eq("id", profile!.id)
    .single();

  const now = new Date();
  const isOpen =
    now >= new Date(r.opens_at) && now <= new Date(r.closes_at);
  const gradeMatch = student?.grade === r.target_grade;

  const [{ data: offerings }, { data: subjects }, { data: myEnrollments }, { data: rules }, { data: demand }] =
    await Promise.all([
      supabase
        .from("course_offerings")
        .select("*")
        .eq("academic_year", r.academic_year)
        .eq("semester", r.semester)
        .eq("grade", r.target_grade)
        .neq("status", "cancelled"),
      supabase.from("subjects").select("*"),
      supabase
        .from("enrollments")
        .select("offering_id, status")
        .eq("round_id", roundId)
        .eq("student_id", profile!.id),
      supabase
        .from("prerequisite_rules")
        .select("subject_id, prerequisite_subject_id, enforcement"),
      supabase.from("v_offering_demand").select("*").eq("round_id", roundId),
    ]);

  // 학생이 이수(예정) 과목: 본인 편제표의 지정과목 + 확정 신청
  const { data: completedRows } = await supabase
    .from("curriculum_entries")
    .select("subject_id, curriculum_plans!inner(admission_year)")
    .eq("is_required", true)
    .eq("curriculum_plans.admission_year", student?.admission_year ?? -1);

  const completedSubjectIds = new Set(
    (completedRows ?? []).map((c) => c.subject_id as string)
  );

  const electives = ((offerings ?? []) as CourseOffering[]).filter(
    (o) => !o.is_required
  );
  const subjectsById = Object.fromEntries(
    ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
  );

  const demandById = new Map(
    ((demand ?? []) as Array<{ offering_id: string; confirmed_count: number }>).map(
      (d) => [d.offering_id, d.confirmed_count]
    )
  );

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

      <h1 className="text-xl font-bold text-slate-900">{r.name}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {r.academic_year}학년도 {r.target_grade}학년 {r.semester}학기
      </p>

      {!gradeMatch ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          이 신청은 {r.target_grade}학년 대상입니다. 신청할 수 없습니다.
        </div>
      ) : !isOpen ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          신청 기간이 아닙니다.
        </div>
      ) : electives.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          신청할 선택과목이 없습니다.
        </div>
      ) : (
        <EnrollForm
          roundId={r.id}
          roundType={r.round_type}
          electives={electives}
          subjectsById={subjectsById}
          initialSelected={Object.fromEntries(
            ((myEnrollments ?? []) as Array<{ offering_id: string; status: string }>)
              .filter((e) => e.status !== "cancelled")
              .map((e) => [e.offering_id, e.status])
          )}
          prereqRules={(rules ?? []) as PrerequisiteRule[]}
          completedSubjectIds={[...completedSubjectIds]}
          confirmedCounts={Object.fromEntries(demandById)}
        />
      )}
    </div>
  );
}
