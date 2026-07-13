"use client";

/** 행 데이터를 CSV(UTF-8 BOM)로 내려받는 버튼. 엑셀에서 한글이 깨지지 않도록 BOM 포함. */
export default function CsvExportButton({
  headers,
  rows,
  filename,
  label = "CSV 내보내기",
  className = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50",
  disabled,
}: {
  headers: string[];
  rows: (string | number | null)[][];
  filename: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  function download() {
    const escape = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || rows.length === 0}
      className={className}
    >
      {label}
    </button>
  );
}
