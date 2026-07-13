"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { studentEmail } from "@/lib/auth-shared";

type Tab = "student" | "staff";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("student");
  const [studentNo, setStudentNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const loginEmail = tab === "student" ? studentEmail(studentNo) : email.trim();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError) {
      setError(
        tab === "student"
          ? "학번 또는 비밀번호가 올바르지 않습니다."
          : "이메일 또는 비밀번호가 올바르지 않습니다."
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
      tab === t
        ? "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-xs)]"
        : "text-[var(--muted)] hover:text-[var(--ink-2)]"
    }`;

  const inputCls =
    "field py-2.5 focus:outline-none focus:border-[var(--accent)]";

  return (
    <main className="relative flex flex-1 items-center justify-center p-4 overflow-hidden">
      {/* 은은한 배경 앰비언스 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-[26rem]">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 grid place-items-center w-12 h-12 rounded-[14px] text-white shadow-[var(--shadow-md)]"
            style={{ background: "var(--accent)" }}
            aria-hidden
          >
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <path
                d="M2.5 3.5h6M2.5 8h6M2.5 12.5h4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="12.5" cy="4" r="1.15" fill="currentColor" />
              <circle cx="12.5" cy="9" r="1.15" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-[1.65rem] font-bold text-[var(--ink)] tracking-tight">
            고교 교육과정 편성 시스템
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            2022 개정교육과정 · 고교학점제
          </p>
        </div>

        <div className="card p-6 shadow-[var(--shadow-lg)]">
          <div className="flex gap-1 p-1 bg-[var(--surface-sunken)] rounded-xl mb-6 border border-[var(--border)]">
            <button
              type="button"
              className={tabClass("student")}
              onClick={() => setTab("student")}
            >
              학생
            </button>
            <button
              type="button"
              className={tabClass("staff")}
              onClick={() => setTab("staff")}
            >
              교사 · 관리자
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "student" ? (
              <div>
                <label className="label">학번</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  placeholder="예: 10315"
                  required
                  className={inputCls}
                />
              </div>
            ) : (
              <div>
                <label className="label">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className="label">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--danger-ink)] bg-[var(--danger-soft)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5"
            >
              {loading ? "로그인 중…" : "로그인"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--faint)]">
          계정이 없거나 비밀번호를 잊은 경우 담당 선생님께 문의하세요.
        </p>
      </div>
    </main>
  );
}
