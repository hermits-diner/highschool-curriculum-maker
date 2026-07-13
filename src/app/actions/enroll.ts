"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EnrollResult = {
  ok: boolean;
  status?: string;
  reason?: string;
};

export async function enrollCourse(
  roundId: string,
  offeringId: string,
  priority?: number
): Promise<EnrollResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enroll_course", {
    p_round_id: roundId,
    p_offering_id: offeringId,
    p_priority: priority ?? null,
  });
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/student", "layout");
  return data as EnrollResult;
}

export async function cancelEnrollment(
  roundId: string,
  offeringId: string
): Promise<EnrollResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_enrollment", {
    p_round_id: roundId,
    p_offering_id: offeringId,
  });
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/student", "layout");
  return data as EnrollResult;
}
