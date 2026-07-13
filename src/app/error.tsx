"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">문제가 발생했습니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          {error.message || "요청을 처리하는 중 오류가 발생했습니다."}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
