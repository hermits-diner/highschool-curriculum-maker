import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/auth-shared";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  redirect(ROLE_HOME[profile.role]);
}
