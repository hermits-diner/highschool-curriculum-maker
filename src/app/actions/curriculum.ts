"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Subject } from "@/lib/types";
import {
  validateCurriculum,
  type EntryInput,
  type ValidationIssue,
} from "@/lib/validation/curriculum";

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

export async function createPlan(formData: FormData) {
  const supabase = await requireAdminClient();
  const year = Number(formData.get("admission_year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new Error("올바른 입학년도를 입력하세요.");

  const { error } = await supabase
    .from("curriculum_plans")
    .insert({ admission_year: year });
  if (error) {
    if (error.code === "23505")
      throw new Error(`${year}학년도 편제표가 이미 존재합니다.`);
    throw new Error(`편제표 생성 실패: ${error.message}`);
  }
  revalidatePath("/admin/curriculum");
  redirect(`/admin/curriculum/${year}`);
}

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string; issues?: ValidationIssue[] };

export async function saveCurriculum(
  planId: string,
  entries: EntryInput[]
): Promise<SaveResult> {
  const supabase = await requireAdminClient();

  const { data: plan } = await supabase
    .from("curriculum_plans")
    .select("id, status, admission_year")
    .eq("id", planId)
    .single();
  if (!plan) return { ok: false, message: "편제표를 찾을 수 없습니다." };
  if (plan.status === "confirmed")
    return { ok: false, message: "확정된 편제표는 수정할 수 없습니다. 확정을 해제한 뒤 수정하세요." };

  // 전량 교체 (편제표 단위 저장)
  const { error: delError } = await supabase
    .from("curriculum_entries")
    .delete()
    .eq("plan_id", planId);
  if (delError) return { ok: false, message: `저장 실패: ${delError.message}` };

  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      plan_id: planId,
      subject_id: e.subject_id,
      grade: e.grade,
      semester: e.semester,
      credits: e.credits,
      is_required: e.is_required,
      choice_group: e.choice_group?.trim() || null,
    }));
    const { error: insError } = await supabase
      .from("curriculum_entries")
      .insert(rows);
    if (insError)
      return { ok: false, message: `저장 실패: ${insError.message}` };
  }

  await supabase
    .from("curriculum_plans")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", planId);

  revalidatePath(`/admin/curriculum/${plan.admission_year}`);
  return { ok: true };
}

export async function confirmPlan(planId: string): Promise<SaveResult> {
  const supabase = await requireAdminClient();

  const { data: plan } = await supabase
    .from("curriculum_plans")
    .select("id, admission_year")
    .eq("id", planId)
    .single();
  if (!plan) return { ok: false, message: "편제표를 찾을 수 없습니다." };

  const [{ data: entries }, { data: subjects }, { data: settings }, { data: rules }] =
    await Promise.all([
      supabase.from("curriculum_entries").select("*").eq("plan_id", planId),
      supabase.from("subjects").select("*"),
      supabase.from("school_settings").select("*").eq("id", 1).single(),
      supabase
        .from("prerequisite_rules")
        .select("subject_id, prerequisite_subject_id, enforcement"),
    ]);

  const subjectsById = Object.fromEntries(
    ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
  );
  const { issues } = validateCurriculum({
    entries: (entries ?? []) as EntryInput[],
    subjectsById,
    settings: settings!,
    prereqRules: rules ?? [],
  });

  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    return {
      ok: false,
      message: `규정 오류 ${errors.length}건을 해결해야 확정할 수 있습니다.`,
      issues: errors,
    };
  }

  await supabase
    .from("curriculum_plans")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", planId);
  revalidatePath(`/admin/curriculum/${plan.admission_year}`);
  return { ok: true };
}

/** 편제표를 다음(또는 지정) 입학년도로 복제 (차년도 롤오버) */
export async function copyCurriculumPlan(
  fromAdmissionYear: number,
  toAdmissionYear: number
): Promise<SaveResult> {
  const supabase = await requireAdminClient();

  const { data: src } = await supabase
    .from("curriculum_plans")
    .select("id")
    .eq("admission_year", fromAdmissionYear)
    .single();
  if (!src) return { ok: false, message: "원본 편제표를 찾을 수 없습니다." };

  const { data: newPlan, error: planError } = await supabase
    .from("curriculum_plans")
    .insert({ admission_year: toAdmissionYear, status: "draft" })
    .select("id")
    .single();
  if (planError || !newPlan) {
    if (planError?.code === "23505")
      return { ok: false, message: `${toAdmissionYear}학년도 편제표가 이미 있습니다.` };
    return { ok: false, message: planError?.message ?? "복제 실패" };
  }

  const { data: entries } = await supabase
    .from("curriculum_entries")
    .select("subject_id, grade, semester, credits, is_required, choice_group, note")
    .eq("plan_id", src.id);

  if (entries?.length) {
    await supabase.from("curriculum_entries").insert(
      entries.map((e) => ({ ...e, plan_id: newPlan.id }))
    );
  }

  revalidatePath("/admin/curriculum");
  return { ok: true };
}

export async function unconfirmPlan(planId: string): Promise<SaveResult> {
  const supabase = await requireAdminClient();
  const { data: plan, error } = await supabase
    .from("curriculum_plans")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .select("admission_year")
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/curriculum/${plan.admission_year}`);
  return { ok: true };
}
