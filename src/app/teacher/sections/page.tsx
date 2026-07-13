import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import RosterEditor, { type RosterSection } from "./RosterEditor";

export default async function TeacherSectionsPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: sections } = await supabase
    .from("sections")
    .select(
      "id, section_no, offering_id, room:rooms(name), offering:course_offerings(academic_year, semester, grade, credits, subject:subjects(name, subject_group, subject_type))"
    )
    .eq("teacher_id", profile!.id);

  const sectionIds = (sections ?? []).map((s) => s.id as string);
  const offeringIds = [
    ...new Set((sections ?? []).map((s) => s.offering_id as string)),
  ];

  const [{ data: roster }, { data: achievements }] = await Promise.all([
    sectionIds.length
      ? supabase
          .from("enrollments")
          .select(
            "section_id, offering_id, student:students(id, student_no, grade, class_no, number, profile:profiles(name))"
          )
          .in("section_id", sectionIds)
          .eq("status", "confirmed")
      : Promise.resolve({ data: [] }),
    offeringIds.length
      ? supabase
          .from("achievements")
          .select("student_id, offering_id, attendance_ok, achievement_pct")
          .in("offering_id", offeringIds)
      : Promise.resolve({ data: [] }),
  ]);

  const achByKey = new Map<
    string,
    { attendance_ok: boolean; achievement_pct: number | null }
  >();
  for (const a of (achievements ?? []) as Array<{
    student_id: string;
    offering_id: string;
    attendance_ok: boolean;
    achievement_pct: number | null;
  }>) {
    achByKey.set(`${a.student_id}:${a.offering_id}`, {
      attendance_ok: a.attendance_ok,
      achievement_pct: a.achievement_pct,
    });
  }

  const rosterBySection = new Map<
    string,
    RosterSection["students"]
  >();
  for (const r of (roster ?? []) as Array<{
    section_id: string;
    offering_id: string;
    student: unknown;
  }>) {
    const st = r.student as {
      id: string;
      student_no: string;
      grade: number;
      class_no: number;
      number: number;
      profile: { name: string } | { name: string }[] | null;
    };
    const nameField = st.profile;
    const name = Array.isArray(nameField) ? nameField[0]?.name : nameField?.name;
    const ach = achByKey.get(`${st.id}:${r.offering_id}`);
    const list = rosterBySection.get(r.section_id) ?? [];
    list.push({
      student_id: st.id,
      offering_id: r.offering_id,
      student_no: st.student_no,
      name: name ?? "",
      loc: st.grade ? `${st.grade}-${st.class_no}-${st.number}` : "",
      attendance_ok: ach?.attendance_ok ?? true,
      achievement_pct: ach?.achievement_pct ?? null,
    });
    rosterBySection.set(r.section_id, list);
  }

  const rows: RosterSection[] = (sections ?? []).map((s) => {
    const offering = s.offering as unknown as {
      academic_year: number;
      semester: number;
      credits: number;
      subject:
        | { name: string; subject_group: string; subject_type: string }
        | { name: string; subject_group: string; subject_type: string }[];
    };
    const subject = Array.isArray(offering.subject)
      ? offering.subject[0]
      : offering.subject;
    const room = s.room as unknown as { name: string } | { name: string }[] | null;
    const roomName = Array.isArray(room) ? room[0]?.name : room?.name;
    return {
      id: s.id as string,
      section_no: s.section_no as number,
      subjectName: subject?.name ?? "",
      subjectType: subject?.subject_type ?? "",
      credits: offering.credits,
      academicYear: offering.academic_year,
      semester: offering.semester,
      roomName: roomName ?? null,
      students: (rosterBySection.get(s.id as string) ?? []).sort((a, b) =>
        a.student_no.localeCompare(b.student_no)
      ),
    };
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">담당 분반 명단 · 성적</h1>
      <p className="mt-1 text-sm text-slate-500">
        담당 분반의 수강 학생 명단과 이수 성적(출석·성취율)을 입력합니다.
        공통과목은 출석 2/3 + 성취율 40% 이상이어야 이수됩니다.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
          아직 배정된 담당 분반이 없습니다.
        </div>
      ) : (
        <RosterEditor sections={rows} />
      )}
    </div>
  );
}
