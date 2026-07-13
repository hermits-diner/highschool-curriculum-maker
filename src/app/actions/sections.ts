"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { roundRobin, sectionCount } from "@/lib/timetable/sectioning";

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

export async function addRoom(formData: FormData) {
  const supabase = await requireAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("강의실 이름을 입력하세요.");
  const group = String(formData.get("subject_group") ?? "").trim();

  const { error } = await supabase.from("rooms").insert({
    name,
    room_type: String(formData.get("room_type")),
    subject_group: group || null,
    capacity: Number(formData.get("capacity")) || 30,
  });
  if (error) {
    if (error.code === "23505") throw new Error("같은 이름의 강의실이 있습니다.");
    throw new Error(`강의실 추가 실패: ${error.message}`);
  }
  revalidatePath("/admin/rooms");
}

export async function deleteRoom(id: string) {
  const supabase = await requireAdminClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) throw new Error(`강의실 삭제 실패: ${error.message}`);
  revalidatePath("/admin/rooms");
}

/** 확정 신청 인원을 분반으로 자동 균형 배정 (선택과목 이동수업 분반) */
export async function autoSection(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await requireAdminClient();
  const academicYear = Number(formData.get("academic_year"));
  const semester = Number(formData.get("semester"));
  const grade = Number(formData.get("grade"));

  const { data: settings } = await supabase
    .from("school_settings")
    .select("default_section_capacity")
    .eq("id", 1)
    .single();
  const defaultCap = settings?.default_section_capacity ?? 28;

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, capacity, is_required")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade)
    .neq("status", "cancelled")
    .eq("is_required", false);

  if (!offerings?.length)
    return { ok: false, message: "해당 범위에 편성할 선택과목이 없습니다." };

  let sectionsMade = 0;
  let studentCount = 0;

  for (const off of offerings) {
    const { data: confirmed } = await supabase
      .from("enrollments")
      .select("id")
      .eq("offering_id", off.id)
      .eq("status", "confirmed")
      .order("created_at");
    if (!confirmed?.length) continue;

    // 기존 분반 제거 (enrollment.section_id는 FK on delete set null로 해제됨)
    await supabase.from("sections").delete().eq("offering_id", off.id);

    const perSection = off.capacity || defaultCap;
    const n = sectionCount(confirmed.length, perSection);

    const { data: created, error: secError } = await supabase
      .from("sections")
      .insert(
        Array.from({ length: n }, (_, i) => ({
          offering_id: off.id,
          section_no: i + 1,
          capacity: perSection,
        }))
      )
      .select("id, section_no");
    if (secError || !created) continue;

    const sorted = created.sort((a, b) => a.section_no - b.section_no);
    // 라운드로빈으로 분반별 학생 묶기
    const buckets = roundRobin(
      confirmed.map((e) => e.id),
      n
    );

    for (let i = 0; i < sorted.length; i++) {
      if (buckets[i].length === 0) continue;
      await supabase
        .from("enrollments")
        .update({ section_id: sorted[i].id })
        .in("id", buckets[i]);
    }
    sectionsMade += n;
    studentCount += confirmed.length;
  }

  revalidatePath("/admin/sections");
  return {
    ok: true,
    message: `분반 ${sectionsMade}개 생성, 학생 ${studentCount}명 배정 완료.`,
  };
}

/** 교과(군)별 강의실을 분반에 자동 일괄 배정 (미지정 분반만). 같은 교과군 분반은 서로 다른 강의실로 분배 */
export async function autoAssignRooms(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await requireAdminClient();
  const academicYear = Number(formData.get("academic_year"));
  const semester = Number(formData.get("semester"));
  const grade = Number(formData.get("grade"));

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, subject:subjects(subject_group)")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade)
    .eq("is_required", false)
    .neq("status", "cancelled");
  if (!offerings?.length)
    return { ok: false, message: "배정할 개설과목이 없습니다." };

  const { data: rooms } = await supabase.from("rooms").select("id, subject_group");
  const roomsByGroup = new Map<string, string[]>();
  for (const r of (rooms ?? []) as Array<{ id: string; subject_group: string | null }>) {
    if (!r.subject_group) continue;
    const list = roomsByGroup.get(r.subject_group) ?? [];
    list.push(r.id);
    roomsByGroup.set(r.subject_group, list);
  }

  const offeringGroup = new Map<string, string>();
  for (const o of offerings) {
    const sub = o.subject as unknown as { subject_group: string } | { subject_group: string }[];
    const group = Array.isArray(sub) ? sub[0]?.subject_group : sub?.subject_group;
    offeringGroup.set(o.id, group ?? "");
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, offering_id, room_id")
    .in("offering_id", offerings.map((o) => o.id));

  // 교과군별 라운드로빈 인덱스로 강의실 순환 배정
  const idxByGroup = new Map<string, number>();
  let assigned = 0;
  for (const sec of (sections ?? []) as Array<{
    id: string;
    offering_id: string;
    room_id: string | null;
  }>) {
    if (sec.room_id) continue; // 이미 배정된 분반 보존
    const group = offeringGroup.get(sec.offering_id) ?? "";
    const pool = roomsByGroup.get(group);
    if (!pool?.length) continue;
    const i = idxByGroup.get(group) ?? 0;
    const roomId = pool[i % pool.length];
    idxByGroup.set(group, i + 1);
    await supabase.from("sections").update({ room_id: roomId }).eq("id", sec.id);
    assigned += 1;
  }

  revalidatePath("/admin/sections");
  return { ok: true, message: `${assigned}개 분반에 강의실을 배정했습니다.` };
}

export async function assignSectionTeacher(
  sectionId: string,
  teacherId: string | null
) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("sections")
    .update({ teacher_id: teacherId })
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sections");
}

export async function assignSectionRoom(
  sectionId: string,
  roomId: string | null
) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("sections")
    .update({ room_id: roomId })
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sections");
}
