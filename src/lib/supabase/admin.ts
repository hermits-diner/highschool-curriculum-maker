import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service role 클라이언트 — 서버 액션/route handler 전용. 클라이언트 코드에서 import 금지.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY가 설정되지 않았습니다. Supabase 대시보드 > Project Settings > API Keys에서 secret key를 .env.local에 넣어주세요."
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
