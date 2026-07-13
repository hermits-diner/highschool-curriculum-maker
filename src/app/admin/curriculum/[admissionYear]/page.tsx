import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumEntry, PrerequisiteRule, SchoolSettings, Subject } from "@/lib/types";
import CurriculumEditor from "./CurriculumEditor";

export default async function CurriculumEditPage({
  params,
}: {
  params: Promise<{ admissionYear: string }>;
}) {
  const { admissionYear } = await params;
  const year = Number(admissionYear);
  if (!Number.isInteger(year)) notFound();

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("curriculum_plans")
    .select("*")
    .eq("admission_year", year)
    .single();
  if (!plan) notFound();

  const [{ data: entries }, { data: subjects }, { data: settings }, { data: rules }] =
    await Promise.all([
      supabase.from("curriculum_entries").select("*").eq("plan_id", plan.id),
      supabase.from("subjects").select("*").order("sort_order"),
      supabase.from("school_settings").select("*").eq("id", 1).single(),
      supabase
        .from("prerequisite_rules")
        .select("id, subject_id, prerequisite_subject_id, enforcement"),
    ]);

  return (
    <div>
      <div className="mb-4 print:hidden">
        <Link
          href="/admin/curriculum"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 편제표 목록
        </Link>
      </div>
      <CurriculumEditor
        plan={plan}
        initialEntries={(entries ?? []) as CurriculumEntry[]}
        subjects={(subjects ?? []) as Subject[]}
        settings={settings as SchoolSettings}
        prereqRules={(rules ?? []) as PrerequisiteRule[]}
      />
    </div>
  );
}
