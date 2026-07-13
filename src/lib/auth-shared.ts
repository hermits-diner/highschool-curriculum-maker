// 클라이언트/서버 공용 인증 유틸 (브라우저에서도 import 가능해야 하므로 서버 전용 코드 금지)

export const STUDENT_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN ?? "student.invalid";

/** 학번 → Supabase Auth용 합성 이메일 (학생은 개인 이메일 없이 학번으로 로그인) */
export function studentEmail(studentNo: string): string {
  return `s${studentNo.trim()}@${STUDENT_EMAIL_DOMAIN}`;
}

export type Role = "admin" | "teacher" | "student";

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  teacher: "교사",
  student: "학생",
};
