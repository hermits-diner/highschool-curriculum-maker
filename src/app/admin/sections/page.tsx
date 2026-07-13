import { createClient } from "@/lib/supabase/server";
import type {
  CourseOffering,
  Room,
  Section,
  Subject,
} from "@/lib/types";
import SectionsManager from "./SectionsManager";

export default async function SectionsPage() {
  const supabase = await createClient();
  const [
    { data: offerings },
    { data: sections },
    { data: subjects },
    { data: rooms },
    { data: teacherRows },
    { data: confirmed },
  ] = await Promise.all([
    supabase
      .from("course_offerings")
      .select("*")
      .eq("is_required", false)
      .neq("status", "cancelled"),
    supabase.from("sections").select("*"),
    supabase.from("subjects").select("*"),
    supabase.from("rooms").select("*").order("name"),
    supabase
      .from("teachers")
      .select("id, subject_group, profiles(name)")
      .order("subject_group"),
    supabase
      .from("enrollments")
      .select("offering_id, section_id")
      .eq("status", "confirmed"),
  ]);

  const teachers = (teacherRows ?? []).map((t) => {
    const p = t.profiles as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(p) ? p[0]?.name : p?.name;
    return {
      id: t.id as string,
      name: name ?? "",
      subject_group: (t.subject_group as string) ?? "",
    };
  });

  // 집계
  const confirmedByOffering = new Map<string, number>();
  const confirmedBySection = new Map<string, number>();
  for (const e of (confirmed ?? []) as Array<{
    offering_id: string;
    section_id: string | null;
  }>) {
    confirmedByOffering.set(
      e.offering_id,
      (confirmedByOffering.get(e.offering_id) ?? 0) + 1
    );
    if (e.section_id)
      confirmedBySection.set(
        e.section_id,
        (confirmedBySection.get(e.section_id) ?? 0) + 1
      );
  }

  // 확정 신청이 있는 개설과목만 표시
  const activeOfferings = ((offerings ?? []) as CourseOffering[]).filter(
    (o) => (confirmedByOffering.get(o.id) ?? 0) > 0
  );

  const scopes = [
    ...new Set(
      activeOfferings.map(
        (o) => `${o.academic_year}-${o.semester}-${o.grade}`
      )
    ),
  ].sort();

  return (
    <SectionsManager
      offerings={activeOfferings}
      sections={(sections ?? []) as Section[]}
      subjectsById={Object.fromEntries(
        ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
      )}
      rooms={(rooms ?? []) as Room[]}
      teachers={teachers}
      confirmedByOffering={Object.fromEntries(confirmedByOffering)}
      confirmedBySection={Object.fromEntries(confirmedBySection)}
      scopes={scopes}
    />
  );
}
