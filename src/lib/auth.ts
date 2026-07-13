import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/auth-shared";

export type Profile = {
  id: string;
  role: Role;
  name: string;
  must_change_password: boolean;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, must_change_password")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

/**
 * 역할별 레이아웃 게이트: 미로그인 → /login, 역할 불일치 → 자기 홈,
 * 비밀번호 변경 필요 → /change-password
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
