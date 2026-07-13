import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/student", label: "홈" },
  { href: "/student/timetable", label: "시간표" },
  { href: "/student/rooms", label: "수강 과목·강의실" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("student");
  return (
    <AppShell role="student" userName={profile.name} nav={NAV}>
      {children}
    </AppShell>
  );
}
