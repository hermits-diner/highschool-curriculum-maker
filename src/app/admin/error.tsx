"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-semibold text-red-800">작업을 완료하지 못했습니다</h2>
      <p className="mt-1.5 text-sm text-red-700">
        {error.message || "오류가 발생했습니다. 잠시 후 다시 시도해주세요."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        다시 시도
      </button>
    </div>
  );
}
