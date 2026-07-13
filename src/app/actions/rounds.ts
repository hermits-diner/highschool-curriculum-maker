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

/** 확정된 편제표의 (학년, 학기) 항목에서 개설과목 생성 (재실행 시 기존 것 유지, 없는 것만 추가) */
export async function generateOfferings(formData: FormData) {
  const supabase = await requireAdminClient();
  const admissionYear = Number(formData.get("admission_year"));
  const grade = Number(formData.get("grade"));
  const semester = Number(formData.get("semester"));
  const academicYear = admissionYear + (grade - 1);

  const { data: plan } = await supabase
    .from("curriculum_plans")
    .select("id, status")
    .eq("admission_year", admissionYear)
    .single();
  if (!plan) throw new Error("편제표를 찾을 수 없습니다.");

  const { data: entries } = await supabase
    .from("curriculum_entries")
    .select("id, subject_id, credits, is_required, choice_group")
    .eq("plan_id", plan.id)
    .eq("grade", grade)
    .eq("semester", semester);

  if (!entries?.length)
    throw new Error("해당 학년·학기에 편성된 과목이 없습니다.");

  const { data: settings } = await supabase
    .from("school_settings")
    .select("classes_per_grade, default_section_capacity, min_students_to_open")
    .eq("id", 1)
    .single();

  // 기존 개설과목(같은 연도·학기·학년) 조회 — 재생성 시 상태·정원·밴드는 보존
  const { data: existing } = await supabase
    .from("course_offerings")
    .select("id, subject_id")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade);
  const existingBySubject = new Map(
    (existing ?? []).map((o) => [o.subject_id as string, o.id as string])
  );

  for (const e of entries) {
    const existingId = existingBySubject.get(e.subject_id);
    if (existingId) {
      // 편제표 파생 필드만 갱신 (capacity/status/band_id 보존)
      await supabase
        .from("course_offerings")
        .update({
          curriculum_entry_id: e.id,
          credits: e.credits,
          is_required: e.is_required,
          choice_group: e.choice_group,
        })
        .eq("id", existingId);
    } else {
      await supabase.from("course_offerings").insert({
        academic_year: academicYear,
        semester,
        grade,
        subject_id: e.subject_id,
        curriculum_entry_id: e.id,
        credits: e.credits,
        is_required: e.is_required,
        choice_group: e.choice_group,
        capacity: e.is_required
          ? (settings?.classes_per_grade ?? 10) *
            (settings?.default_section_capacity ?? 28)
          : (settings?.default_section_capacity ?? 28),
        min_students: settings?.min_students_to_open ?? 13,
        status: "planned",
      });
    }
  }

  revalidatePath("/admin/rounds");
}

export async function createRound(formData: FormData) {
  const supabase = await requireAdminClient();

  const { error } = await supabase.from("enrollment_rounds").insert({
    name: String(formData.get("name") ?? "").trim(),
    academic_year: Number(formData.get("academic_year")),
    target_grade: Number(formData.get("target_grade")),
    semester: Number(formData.get("semester")),
    round_type: String(formData.get("round_type")),
    opens_at: new Date(String(formData.get("opens_at"))).toISOString(),
    closes_at: new Date(String(formData.get("closes_at"))).toISOString(),
    max_choices: formData.get("max_choices")
      ? Number(formData.get("max_choices"))
      : null,
  });
  if (error) throw new Error(`라운드 생성 실패: ${error.message}`);
  revalidatePath("/admin/rounds");
}

export async function deleteRound(id: string) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("enrollment_rounds")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`라운드 삭제 실패: ${error.message}`);
  revalidatePath("/admin/rounds");
}

export async function setOfferingStatus(id: string, status: string) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("course_offerings")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`상태 변경 실패: ${error.message}`);
  revalidatePath("/admin/rounds");
}

export async function updateOfferingCapacity(
  id: string,
  capacity: number
): Promise<{ promoted: number }> {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("course_offerings")
    .update({ capacity })
    .eq("id", id);
  if (error) throw new Error(`정원 변경 실패: ${error.message}`);
  // 정원이 늘었으면 대기자를 신청순으로 자동 승격
  const { data: promoted } = await supabase.rpc("promote_waitlist", {
    p_offering_id: id,
  });
  revalidatePath("/admin/rounds");
  return { promoted: (promoted as number) ?? 0 };
}
