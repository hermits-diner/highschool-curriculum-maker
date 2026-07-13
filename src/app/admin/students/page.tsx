import { createClient } from "@/lib/supabase/server";
import StudentManager from "./StudentManager";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, student_no, name:profiles(name), grade, class_no, number, status, admission_year")
    .order("student_no");

  const students = (data ?? []).map((s) => {
    const nameField = s.name as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(nameField)
      ? nameField[0]?.name
      : nameField?.name;
    return {
      id: s.id as string,
      student_no: s.student_no as string,
      name: name ?? "",
      grade: s.grade as number | null,
      class_no: s.class_no as number | null,
      number: s.number as number | null,
      status: s.status as string,
      admission_year: s.admission_year as number,
    };
  });

  const hasSecretKey = !!process.env.SUPABASE_SECRET_KEY;

  return <StudentManager students={students} hasSecretKey={hasSecretKey} />;
}
