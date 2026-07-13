"use client";

import { useState, useTransition } from "react";

/**
 * 파괴적 작업용 인라인 확인 버튼. 네이티브 confirm() 대신 2단계로 확인받는다.
 * action: 미리 bind된 서버 액션(무인자) 또는 임의 async 함수.
 */
export default function ConfirmButton({
  action,
  children,
  confirmText = "확인",
  cancelText = "취소",
  className = "text-xs text-red-500 hover:text-red-700",
  confirmClassName = "text-xs text-red-600 font-medium",
  question = "정말 진행할까요?",
}: {
  action: () => void | Promise<unknown>;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  className?: string;
  confirmClassName?: string;
  question?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xs text-slate-500">{question}</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await action();
              setArmed(false);
            })
          }
          className={confirmClassName}
        >
          {confirmText}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {cancelText}
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setArmed(true)} className={className}>
      {children}
    </button>
  );
}
