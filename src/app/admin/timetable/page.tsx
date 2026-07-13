import { createClient } from "@/lib/supabase/server";
import type { CourseOffering, Subject } from "@/lib/types";
import { findConflicts, type MeetingRecord } from "@/lib/timetable/conflicts";
import TimetableBoard from "./TimetableBoard";

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: scopeParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: offerings }, { data: subjects }, { data: settings }] =
    await Promise.all([
      supabase
        .from("course_offerings")
        .select("*")
        .eq("is_required", false)
        .neq("status", "cancelled"),
      supabase.from("subjects").select("*"),
      supabase
        .from("school_settings")
        .select("periods_per_day, days_per_week")
        .eq("id", 1)
        .single(),
    ]);

  // 확정 신청이 있는 개설과목만
  const { data: confirmedAll } = await supabase
    .from("enrollments")
    .select("offering_id, section_id, student_id")
    .eq("status", "confirmed");

  const confirmedByOffering = new Map<string, number>();
  for (const e of (confirmedAll ?? []) as Array<{ offering_id: string }>) {
    confirmedByOffering.set(
      e.offering_id,
      (confirmedByOffering.get(e.offering_id) ?? 0) + 1
    );
  }

  const activeOfferings = ((offerings ?? []) as CourseOffering[]).filter(
    (o) => (confirmedByOffering.get(o.id) ?? 0) > 0
  );
  const scopes = [
    ...new Set(
      activeOfferings.map((o) => `${o.academic_year}-${o.semester}-${o.grade}`)
    ),
  ].sort();

  const scope = scopeParam && scopes.includes(scopeParam) ? scopeParam : scopes[0];

  if (!scope) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900">시간표 편성</h1>
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          확정된 수강신청 인원이 없습니다. 수강신청·분반을 먼저 진행하세요.
        </div>
      </div>
    );
  }

  const [ay, sem, grade] = scope.split("-").map(Number);
  const scopeOfferings = activeOfferings.filter(
    (o) => `${o.academic_year}-${o.semester}-${o.grade}` === scope
  );
  const offeringIds = scopeOfferings.map((o) => o.id);

  const [
    { data: bands },
    { data: bandSlots },
    { data: sections },
    { data: matrix },
    { data: timetable },
  ] = await Promise.all([
    supabase
      .from("bands")
      .select("*")
      .eq("academic_year", ay)
      .eq("semester", sem)
      .eq("grade", grade)
      .order("created_at"),
    supabase.from("band_slots").select("*"),
    supabase.from("sections").select("id, offering_id, section_no, teacher_id, room_id"),
    supabase.rpc("co_enrollment_matrix", {
      p_ay: ay,
      p_sem: sem,
      p_grade: grade,
    }),
    supabase
      .from("timetables")
      .select("status")
      .eq("academic_year", ay)
      .eq("semester", sem)
      .eq("grade", grade)
      .maybeSingle(),
  ]);

  // 충돌 검증은 지정+선택 모든 분반을 대상으로 (원반 vs 밴드 시간 겹침도 감지)
  const { data: allScopeOfferings } = await supabase
    .from("course_offerings")
    .select("id, subject_id")
    .eq("academic_year", ay)
    .eq("semester", sem)
    .eq("grade", grade)
    .neq("status", "cancelled");
  const allScopeOfferingIds = (allScopeOfferings ?? []).map((o) => o.id as string);

  const scopeSections = (sections ?? []).filter((s) =>
    allScopeOfferingIds.includes(s.offering_id as string)
  );
  const scopeSectionIds = scopeSections.map((s) => s.id as string);

  // section_meetings for conflict check
  const { data: meetings } = scopeSectionIds.length
    ? await supabase
        .from("section_meetings")
        .select("section_id, day, period, room_id")
        .in("section_id", scopeSectionIds)
    : { data: [] };

  // 분반별 학생/교사 매핑
  const studentsBySection = new Map<string, string[]>();
  for (const e of (confirmedAll ?? []) as Array<{
    section_id: string | null;
    student_id: string;
  }>) {
    if (!e.section_id) continue;
    const list = studentsBySection.get(e.section_id) ?? [];
    list.push(e.student_id);
    studentsBySection.set(e.section_id, list);
  }
  const sectionMeta = new Map(
    scopeSections.map((s) => [
      s.id as string,
      { teacher_id: s.teacher_id as string | null, offering_id: s.offering_id as string },
    ])
  );
  const subjectsById = Object.fromEntries(
    ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
  );
  const offeringSubject = new Map(
    (allScopeOfferings ?? []).map((o) => [
      o.id as string,
      subjectsById[o.subject_id as string]?.name ?? "",
    ])
  );

  const meetingRecords: MeetingRecord[] = ((meetings ?? []) as Array<{
    section_id: string;
    day: number;
    period: number;
    room_id: string | null;
  }>).map((m) => {
    const meta = sectionMeta.get(m.section_id);
    return {
      section_id: m.section_id,
      day: m.day,
      period: m.period,
      room_id: m.room_id,
      teacher_id: meta?.teacher_id ?? null,
      subject_name: meta ? offeringSubject.get(meta.offering_id) ?? "" : "",
      student_ids: studentsBySection.get(m.section_id) ?? [],
    };
  });
  const conflicts = findConflicts(meetingRecords);

  const meetingCountBySection = new Map<string, number>();
  for (const m of meetings ?? []) {
    meetingCountBySection.set(
      m.section_id as string,
      (meetingCountBySection.get(m.section_id as string) ?? 0) + 1
    );
  }

  return (
    <TimetableBoard
      scope={scope}
      scopes={scopes}
      periodsPerDay={settings?.periods_per_day ?? 7}
      daysPerWeek={settings?.days_per_week ?? 5}
      offerings={scopeOfferings}
      subjectsById={subjectsById}
      bands={(bands ?? []).map((b) => ({
        id: b.id as string,
        name: b.name as string,
      }))}
      bandSlots={(bandSlots ?? []) as Array<{
        band_id: string;
        day: number;
        period: number;
      }>}
      sectionsByOffering={Object.fromEntries(
        scopeOfferings.map((o) => [
          o.id,
          scopeSections
            .filter((s) => s.offering_id === o.id)
            .map((s) => ({
              id: s.id as string,
              section_no: s.section_no as number,
              meetingCount: meetingCountBySection.get(s.id as string) ?? 0,
            })),
        ])
      )}
      coEnrollment={((matrix ?? []) as Array<{
        offering_a: string;
        offering_b: string;
        shared: number;
      }>).map((m) => ({ a: m.offering_a, b: m.offering_b, shared: m.shared }))}
      conflicts={conflicts}
      timetableStatus={(timetable?.status as string) ?? "draft"}
    />
  );
}
