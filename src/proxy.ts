import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 세션 토큰 갱신 + 로그인 게이트. 역할·비밀번호 변경 검사는 각 레이아웃(requireRole)에서 수행.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";

  const redirectTo = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    // 갱신된 세션 쿠키를 리다이렉트 응답에도 복사
    response.cookies.getAll().forEach((c) => r.cookies.set(c.name, c.value));
    return r;
  };

  if (!user && !isLoginPage) return redirectTo("/login");
  if (user && isLoginPage) return redirectTo("/");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
