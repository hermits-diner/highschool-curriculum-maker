import AppShell from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/teacher", label: "대시보드" },
  { href: "/teacher/sections", label: "담당 분반" },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("teacher");
  return (
    <AppShell role="teacher" userName={profile.name} nav={NAV}>
      {children}
    </AppShell>
  );
}
