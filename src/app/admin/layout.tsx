import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/settings", label: "학교 설정" },
  { href: "/admin/subjects", label: "과목 관리" },
  { href: "/admin/curriculum", label: "편제표" },
  { href: "/admin/students", label: "학생 계정" },
  { href: "/admin/rounds", label: "수강신청" },
  { href: "/admin/rooms", label: "강의실" },
  { href: "/admin/sections", label: "분반" },
  { href: "/admin/homeroom", label: "원반시간표" },
  { href: "/admin/timetable", label: "시간표" },
  { href: "/admin/progress", label: "이수현황" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");
  return (
    <AppShell role="admin" userName={profile.name} nav={NAV}>
      {children}
    </AppShell>
  );
}
