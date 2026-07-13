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
    `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? "bg-white text-slate-900 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            고교 교육과정 편성 시스템
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            2022 개정교육과정 · 고교학점제
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  학번
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  placeholder="예: 10315"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          계정이 없거나 비밀번호를 잊은 경우 담당 선생님께 문의하세요.
        </p>
      </div>
    </main>
  );
}
