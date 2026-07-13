"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
  return supabase;
}

/**
 * 지정(공통·학교지정) 과목을 학급(원반) 단위로 편성한다.
 * - 각 지정 개설과목마다 학급 수만큼 분반(section_no=class_no, class_no 지정) 생성
 * - 해당 학급 학생을 confirmed enrollment(round_id=null)로 자동 배정
 */
export async function assignHomeroom(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await requireAdminClient();
  const academicYear = Number(formData.get("academic_year"));
  const semester = Number(formData.get("semester"));
  const grade = Number(formData.get("grade"));

  const { data: settings } = await supabase
    .from("school_settings")
    .select("classes_per_grade")
    .eq("id", 1)
    .single();
  const classes = settings?.classes_per_grade ?? 10;

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade)
    .eq("is_required", true)
    .neq("status", "cancelled");

  if (!offerings?.length)
    return { ok: false, message: "지정과목 개설이 없습니다. 먼저 개설과목을 생성하세요." };

  // 해당 학년 학생을 학급별로 그룹핑
  const { data: students } = await supabase
    .from("students")
    .select("id, class_no")
    .eq("grade", grade)
    .eq("status", "재학");
  const studentsByClass = new Map<number, string[]>();
  for (const s of (students ?? []) as Array<{ id: string; class_no: number | null }>) {
    if (s.class_no == null) continue;
    const list = studentsByClass.get(s.class_no) ?? [];
    list.push(s.id);
    studentsByClass.set(s.class_no, list);
  }

  let sectionCount = 0;
  let enrollCount = 0;

  for (const off of offerings) {
    // 기존 지정 분반 제거(선택과목 분반은 class_no=null이라 영향 없음)
    const { data: oldSections } = await supabase
      .from("sections")
      .select("id")
      .eq("offering_id", off.id)
      .not("class_no", "is", null);
    if (oldSections?.length) {
      const ids = oldSections.map((s) => s.id);
      await supabase.from("enrollments").delete().in("section_id", ids);
      await supabase.from("sections").delete().in("id", ids);
    }

    for (let c = 1; c <= classes; c++) {
      const classStudents = studentsByClass.get(c) ?? [];
      const { data: sec } = await supabase
        .from("sections")
        .insert({
          offering_id: off.id,
          section_no: c,
          class_no: c,
          capacity: Math.max(classStudents.length, 1),
        })
        .select("id")
        .single();
      if (!sec) continue;
      sectionCount += 1;

      if (classStudents.length > 0) {
        const rows = classStudents.map((sid) => ({
          round_id: null,
          student_id: sid,
          offering_id: off.id,
          status: "confirmed" as const,
          section_id: sec.id,
        }));
        const { error } = await supabase.from("enrollments").insert(rows);
        if (!error) enrollCount += rows.length;
      }
    }
  }

  revalidatePath("/admin/homeroom");
  return {
    ok: true,
    message: `원반 ${sectionCount}개 편성, 지정과목 배정 ${enrollCount}건 완료.`,
  };
}

/** 학급 전체 지정과목 분반의 기본 강의실을 일괄 지정 */
export async function setHomeroomRoom(
  academicYear: number,
  semester: number,
  grade: number,
  classNo: number,
  roomId: string | null
) {
  const supabase = await requireAdminClient();
  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade)
    .eq("is_required", true);
  const offeringIds = (offerings ?? []).map((o) => o.id);
  if (!offeringIds.length) return;

  const { data: secs } = await supabase
    .from("sections")
    .select("id")
    .in("offering_id", offeringIds)
    .eq("class_no", classNo);
  const secIds = (secs ?? []).map((s) => s.id);
  if (!secIds.length) return;

  await supabase.from("sections").update({ room_id: roomId }).in("id", secIds);
  await supabase
    .from("section_meetings")
    .update({ room_id: roomId })
    .in("section_id", secIds);
  revalidatePath("/admin/homeroom");
}

/** 원반 시간표: 특정 학급의 (요일,교시)에 지정과목 배치/해제 */
export async function setHomeroomMeeting(
  sectionId: string,
  day: number,
  period: number,
  on: boolean
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await requireAdminClient();

  if (!on) {
    await supabase
      .from("section_meetings")
      .delete()
      .eq("section_id", sectionId)
      .eq("day", day)
      .eq("period", period);
    revalidatePath("/admin/homeroom");
    return { ok: true };
  }

  // 같은 학급(같은 class_no) 다른 과목이 이미 그 슬롯을 쓰면 거부
  const { data: sec } = await supabase
    .from("sections")
    .select("class_no, room_id, offering:course_offerings(academic_year, semester, grade)")
    .eq("id", sectionId)
    .single();
  if (!sec) return { ok: false, message: "분반을 찾을 수 없습니다." };

  const off = sec.offering as unknown as {
    academic_year: number;
    semester: number;
    grade: number;
  };
  // 같은 학급의 모든 지정 분반 id
  const { data: offs } = await supabase
    .from("course_offerings")
    .select("id")
    .eq("academic_year", off.academic_year)
    .eq("semester", off.semester)
    .eq("grade", off.grade)
    .eq("is_required", true);
  const offIds = (offs ?? []).map((o) => o.id);
  const { data: classSections } = await supabase
    .from("sections")
    .select("id")
    .in("offering_id", offIds)
    .eq("class_no", sec.class_no);
  const classSectionIds = (classSections ?? []).map((s) => s.id);

  const { data: clash } = await supabase
    .from("section_meetings")
    .select("id")
    .in("section_id", classSectionIds)
    .eq("day", day)
    .eq("period", period)
    .neq("section_id", sectionId)
    .maybeSingle();
  if (clash)
    return { ok: false, message: "이 학급의 해당 교시에 이미 다른 지정과목이 있습니다." };

  const { error } = await supabase.from("section_meetings").insert({
    section_id: sectionId,
    day,
    period,
    room_id: sec.room_id,
  });
  if (error && error.code !== "23505")
    return { ok: false, message: error.message };

  revalidatePath("/admin/homeroom");
  return { ok: true };
}
