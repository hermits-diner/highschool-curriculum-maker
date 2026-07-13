"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(
        updateError.message.includes("different from the old")
          ? "기존 비밀번호와 다른 비밀번호를 사용해주세요."
          : "비밀번호 변경에 실패했습니다. 다시 시도해주세요."
      );
      setLoading(false);
      return;
    }

    await supabase.rpc("mark_password_changed");
    // 레이아웃 게이트를 다시 통과하도록 전체 이동
    window.location.href = "/";
  }

  const inputCls = "field py-2.5 focus:outline-none focus:border-[var(--accent)]";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-[24rem]">
        <div className="card p-6 shadow-[var(--shadow-lg)]">
          <h1 className="text-lg font-bold text-[var(--ink)]">비밀번호 변경</h1>
          <p className="mt-1 mb-6 text-sm text-[var(--muted)]">
            처음 로그인하셨습니다. 계속하려면 새 비밀번호를 설정하세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">새 비밀번호 (8자 이상)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputCls}
              />
            </div>
            <div>
              <label className="label">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
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
              {loading ? "변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
