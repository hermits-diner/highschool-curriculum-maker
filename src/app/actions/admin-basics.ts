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

export async function updateSettings(formData: FormData) {
  const supabase = await requireAdminClient();
  const num = (k: string) => Number(formData.get(k));
  const maxSubjects = formData.get("max_subjects_per_semester");

  const { error } = await supabase
    .from("school_settings")
    .update({
      school_name: String(formData.get("school_name") ?? "").trim(),
      classes_per_grade: num("classes_per_grade"),
      min_credits_per_semester: num("min_credits_per_semester"),
      max_credits_per_semester: num("max_credits_per_semester"),
      max_subjects_per_semester:
        maxSubjects && String(maxSubjects).trim() !== ""
          ? Number(maxSubjects)
          : null,
      min_students_to_open: num("min_students_to_open"),
      default_section_capacity: num("default_section_capacity"),
      periods_per_day: num("periods_per_day"),
      days_per_week: num("days_per_week"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(`설정 저장 실패: ${error.message}`);
  revalidatePath("/admin", "layout");
}

export async function addCustomSubject(formData: FormData) {
  const supabase = await requireAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("과목명을 입력하세요.");
  const credits = Number(formData.get("credits"));
  const min = Number(formData.get("min_credits"));
  const max = Number(formData.get("max_credits"));
  if (!(min <= credits && credits <= max))
    throw new Error("학점 범위가 올바르지 않습니다 (최소 ≤ 기본 ≤ 최대).");

  const { error } = await supabase.from("subjects").insert({
    code: `CUSTOM-${Date.now()}`,
    name,
    subject_group: String(formData.get("subject_group")),
    subject_type: String(formData.get("subject_type")),
    default_credits: credits,
    min_credits: min,
    max_credits: max,
    is_custom: true,
    sort_order: 9000,
  });
  if (error) throw new Error(`과목 추가 실패: ${error.message}`);
  revalidatePath("/admin/subjects");
}

export async function deleteCustomSubject(id: string) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("is_custom", true);
  if (error) throw new Error(`과목 삭제 실패: ${error.message}`);
  revalidatePath("/admin/subjects");
}

export async function addPrereqRule(formData: FormData) {
  const supabase = await requireAdminClient();
  const subjectId = String(formData.get("subject_id"));
  const prereqId = String(formData.get("prerequisite_subject_id"));
  if (subjectId === prereqId)
    throw new Error("대상 과목과 선수과목이 같을 수 없습니다.");

  const { error } = await supabase.from("prerequisite_rules").upsert(
    {
      subject_id: subjectId,
      prerequisite_subject_id: prereqId,
      enforcement: String(formData.get("enforcement")),
    },
    { onConflict: "subject_id,prerequisite_subject_id" }
  );
  if (error) throw new Error(`규칙 추가 실패: ${error.message}`);
  revalidatePath("/admin/subjects");
}

export async function deletePrereqRule(id: string) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("prerequisite_rules")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`규칙 삭제 실패: ${error.message}`);
  revalidatePath("/admin/subjects");
}
