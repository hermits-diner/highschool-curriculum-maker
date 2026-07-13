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

export async function createBand(
  academicYear: number,
  semester: number,
  grade: number,
  name: string
) {
  const supabase = await requireAdminClient();
  const { error } = await supabase.from("bands").insert({
    academic_year: academicYear,
    semester,
    grade,
    name: name.trim() || "새 밴드",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/timetable");
}

export async function deleteBand(id: string) {
  const supabase = await requireAdminClient();
  // 소속 개설과목의 band_id 해제 후 밴드 삭제
  await supabase.from("course_offerings").update({ band_id: null }).eq("band_id", id);
  const { error } = await supabase.from("bands").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/timetable");
}

export async function setOfferingBand(
  offeringId: string,
  bandId: string | null
) {
  const supabase = await requireAdminClient();
  const { error } = await supabase
    .from("course_offerings")
    .update({ band_id: bandId })
    .eq("id", offeringId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/timetable");
}

export async function toggleBandSlot(
  bandId: string,
  day: number,
  period: number,
  on: boolean
) {
  const supabase = await requireAdminClient();
  if (on) {
    const { error } = await supabase
      .from("band_slots")
      .insert({ band_id: bandId, day, period });
    if (error && error.code !== "23505") throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("band_slots")
      .delete()
      .eq("band_id", bandId)
      .eq("day", day)
      .eq("period", period);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/timetable");
}

/** 밴드에 배정된 개설과목의 분반들에 대해 밴드 슬롯대로 section_meetings 생성 */
export async function generateMeetings(
  academicYear: number,
  semester: number,
  grade: number
): Promise<{ ok: boolean; message: string }> {
  const supabase = await requireAdminClient();

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, band_id")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .eq("grade", grade)
    .not("band_id", "is", null);

  if (!offerings?.length)
    return { ok: false, message: "밴드에 배정된 개설과목이 없습니다." };

  // 밴드별 슬롯
  const { data: slots } = await supabase.from("band_slots").select("*");
  const slotsByBand = new Map<string, Array<{ day: number; period: number }>>();
  for (const s of (slots ?? []) as Array<{
    band_id: string;
    day: number;
    period: number;
  }>) {
    const list = slotsByBand.get(s.band_id) ?? [];
    list.push({ day: s.day, period: s.period });
    slotsByBand.set(s.band_id, list);
  }

  let meetingCount = 0;
  for (const off of offerings) {
    const bandSlots = slotsByBand.get(off.band_id as string);
    if (!bandSlots?.length) continue;

    const { data: sections } = await supabase
      .from("sections")
      .select("id, room_id")
      .eq("offering_id", off.id);
    if (!sections?.length) continue;

    for (const sec of sections) {
      await supabase.from("section_meetings").delete().eq("section_id", sec.id);
      const rows = bandSlots.map((s) => ({
        section_id: sec.id,
        day: s.day,
        period: s.period,
        room_id: sec.room_id,
      }));
      const { error } = await supabase.from("section_meetings").insert(rows);
      if (!error) meetingCount += rows.length;
    }
  }

  // 시간표 레코드 보장 (draft)
  await supabase
    .from("timetables")
    .upsert(
      { academic_year: academicYear, semester, grade, status: "draft" },
      { onConflict: "academic_year,semester,grade", ignoreDuplicates: true }
    );

  revalidatePath("/admin/timetable");
  return { ok: true, message: `시간표 회차 ${meetingCount}개 생성 완료.` };
}

export async function setTimetableStatus(
  academicYear: number,
  semester: number,
  grade: number,
  status: "draft" | "published"
) {
  const supabase = await requireAdminClient();
  const { error } = await supabase.from("timetables").upsert(
    {
      academic_year: academicYear,
      semester,
      grade,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "academic_year,semester,grade" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/timetable");
  revalidatePath("/student", "layout");
}
