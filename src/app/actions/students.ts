"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentEmail } from "@/lib/auth-shared";

async function assertAdmin() {
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
}

export type ParsedStudent = {
  student_no: string;
  name: string;
  admission_year: number;
  grade: number;
  class_no: number;
  number: number;
};

export type ImportResult = {
  created: Array<{ student_no: string; name: string; password: string }>;
  errors: Array<{ student_no: string; message: string }>;
};

/** 초기 비밀번호: 학번 + 학교 코드. 학생이 최초 로그인 시 변경 강제됨. */
function initialPassword(studentNo: string): string {
  return `hs${studentNo}!`;
}

export async function importStudents(
  rows: ParsedStudent[]
): Promise<ImportResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const result: ImportResult = { created: [], errors: [] };

  for (const row of rows) {
    const email = studentEmail(row.student_no);
    const password = initialPassword(row.student_no);
    try {
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (createError || !created.user) {
        result.errors.push({
          student_no: row.student_no,
          message: createError?.message ?? "계정 생성 실패",
        });
        continue;
      }

      const uid = created.user.id;
      const { error: profileError } = await admin.from("profiles").insert({
        id: uid,
        role: "student",
        name: row.name,
        must_change_password: true,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(uid);
        result.errors.push({
          student_no: row.student_no,
          message: profileError.message,
        });
        continue;
      }

      const { error: studentError } = await admin.from("students").insert({
        id: uid,
        student_no: row.student_no,
        admission_year: row.admission_year,
        grade: row.grade,
        class_no: row.class_no,
        number: row.number,
      });
      if (studentError) {
        await admin.auth.admin.deleteUser(uid);
        result.errors.push({
          student_no: row.student_no,
          message: studentError.message,
        });
        continue;
      }

      result.created.push({
        student_no: row.student_no,
        name: row.name,
        password,
      });
    } catch (e) {
      result.errors.push({
        student_no: row.student_no,
        message: e instanceof Error ? e.message : "알 수 없는 오류",
      });
    }
  }

  revalidatePath("/admin/students");
  return result;
}

/** 학년 진급: 재학생 학년+1, 3학년은 졸업 처리. (신학년도 롤오버) */
export async function promoteStudents(): Promise<{
  ok: boolean;
  message: string;
}> {
  await assertAdmin();
  const admin = createAdminClient();

  // 3학년 → 졸업
  const { error: gradError, count: gradCount } = await admin
    .from("students")
    .update({ status: "졸업" }, { count: "exact" })
    .eq("status", "재학")
    .eq("grade", 3);
  if (gradError) return { ok: false, message: gradError.message };

  // 2학년 → 3학년, 1학년 → 2학년 (높은 학년부터 처리해 충돌 방지)
  for (const g of [2, 1]) {
    const { error } = await admin
      .from("students")
      .update({ grade: g + 1 })
      .eq("status", "재학")
      .eq("grade", g);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/admin/students");
  return {
    ok: true,
    message: `진급 완료 (졸업 ${gradCount ?? 0}명). 신입생은 CSV로 등록하세요.`,
  };
}

export async function resetStudentPassword(
  studentId: string
): Promise<{ ok: boolean; password?: string; message?: string }> {
  await assertAdmin();
  const admin = createAdminClient();

  const { data: student } = await admin
    .from("students")
    .select("student_no")
    .eq("id", studentId)
    .single();
  if (!student) return { ok: false, message: "학생을 찾을 수 없습니다." };

  const password = initialPassword(student.student_no);
  const { error: updateError } = await admin.auth.admin.updateUserById(
    studentId,
    { password }
  );
  if (updateError) return { ok: false, message: updateError.message };

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", studentId);

  revalidatePath("/admin/students");
  return { ok: true, password };
}
