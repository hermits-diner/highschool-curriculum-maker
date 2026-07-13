"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setAchievement(
  studentId: string,
  offeringId: string,
  attendanceOk: boolean,
  achievementPct: number | null
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_achievement", {
    p_student_id: studentId,
    p_offering_id: offeringId,
    p_attendance_ok: attendanceOk,
    p_achievement_pct: achievementPct,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/sections");
  revalidatePath("/student", "layout");
  return { ok: true };
}
