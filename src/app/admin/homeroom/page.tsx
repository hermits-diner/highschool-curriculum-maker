import { createClient } from "@/lib/supabase/server";
import type { Room, Subject } from "@/lib/types";
import HomeroomEditor from "./HomeroomEditor";

export default async function HomeroomPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; class?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: reqOfferings }, { data: subjects }, { data: settings }, { data: rooms }] =
    await Promise.all([
      supabase
        .from("course_offerings")
        .select("id, academic_year, semester, grade, subject_id, credits")
        .eq("is_required", true)
        .neq("status", "cancelled"),
      supabase.from("subjects").select("*"),
      supabase
        .from("school_settings")
        .select("classes_per_grade, periods_per_day, days_per_week")
        .eq("id", 1)
        .single(),
      supabase.from("rooms").select("*").order("name"),
    ]);

  const scopes = [
    ...new Set(
      (reqOfferings ?? []).map(
        (o) => `${o.academic_year}-${o.semester}-${o.grade}`
      )
    ),
  ].sort();

  const scope = sp.scope && scopes.includes(sp.scope) ? sp.scope : scopes[0];

  if (!scope) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900">원반 시간표</h1>
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          지정과목 개설이 없습니다. 수강신청 화면에서 개설과목을 먼저 생성하세요.
        </div>
      </div>
    );
  }

  const [ay, sem, grade] = scope.split("-").map(Number);
  const classesPerGrade = settings?.classes_per_grade ?? 10;
  const classNo = sp.class ? Number(sp.class) : 1;

  const scopeOfferings = (reqOfferings ?? []).filter(
    (o) => `${o.academic_year}-${o.semester}-${o.grade}` === scope
  );
  const subjectsById = Object.fromEntries(
    ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
  );
  const offeringIds = scopeOfferings.map((o) => o.id);

  // 이 학급의 지정과목 분반
  const { data: sections } = offeringIds.length
    ? await supabase
        .from("sections")
        .select("id, offering_id, class_no, room_id")
        .in("offering_id", offeringIds)
        .eq("class_no", classNo)
    : { data: [] };

  const sectionByOffering = new Map(
    (sections ?? []).map((s) => [s.offering_id as string, s])
  );
  const sectionIds = (sections ?? []).map((s) => s.id as string);

  const { data: meetings } = sectionIds.length
    ? await supabase
        .from("section_meetings")
        .select("section_id, day, period")
        .in("section_id", sectionIds)
    : { data: [] };

  const homeroomAssigned = (sections ?? []).length > 0;
  const currentRoomId =
    (sections ?? []).find((s) => s.room_id)?.room_id ?? null;

  const offeringRows = scopeOfferings
    .map((o) => {
      const sec = sectionByOffering.get(o.id);
      const placed = (meetings ?? []).filter(
        (m) => m.section_id === sec?.id
      ).length;
      return {
        offering_id: o.id,
        section_id: (sec?.id as string) ?? null,
        subject_name: subjectsById[o.subject_id]?.name ?? "",
        credits: o.credits as number,
        placed,
        sort: subjectsById[o.subject_id]?.sort_order ?? 0,
      };
    })
    .sort((a, b) => a.sort - b.sort);

  return (
    <HomeroomEditor
      scope={scope}
      scopes={scopes}
      classNo={classNo}
      classesPerGrade={classesPerGrade}
      periodsPerDay={settings?.periods_per_day ?? 7}
      daysPerWeek={settings?.days_per_week ?? 5}
      ay={ay}
      sem={sem}
      grade={grade}
      homeroomAssigned={homeroomAssigned}
      offeringRows={offeringRows}
      meetings={(meetings ?? []) as Array<{
        section_id: string;
        day: number;
        period: number;
      }>}
      rooms={(rooms ?? []) as Room[]}
      currentRoomId={currentRoomId}
    />
  );
}
