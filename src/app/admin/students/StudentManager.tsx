"use client";

import { useState, useTransition } from "react";
import {
  importStudents,
  promoteStudents,
  resetStudentPassword,
  type ImportResult,
  type ParsedStudent,
} from "@/app/actions/students";
import CsvExportButton from "@/components/CsvExportButton";
import ConfirmButton from "@/components/ConfirmButton";

type Student = {
  id: string;
  student_no: string;
  name: string;
  grade: number | null;
  class_no: number | null;
  number: number | null;
  status: string;
  admission_year: number;
};

const SAMPLE = `학번,이름,입학년도,학년,반,번호
10101,김민준,2026,1,1,1
10102,이서연,2026,1,1,2
10103,박도윤,2026,1,1,3`;

function parseCsv(text: string): {
  rows: ParsedStudent[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ParsedStudent[] = [];
  const errors: string[] = [];
  if (lines.length === 0) return { rows, errors };

  // 헤더 스킵 (첫 줄에 '학번' 포함 시)
  const start = lines[0].includes("학번") ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 6) {
      errors.push(`${i + 1}행: 열이 부족합니다 (학번,이름,입학년도,학년,반,번호).`);
      continue;
    }
    const [student_no, name, admission_year, grade, class_no, number] = parts;
    if (!student_no || !name) {
      errors.push(`${i + 1}행: 학번 또는 이름이 비어 있습니다.`);
      continue;
    }
    rows.push({
      student_no,
      name,
      admission_year: Number(admission_year),
      grade: Number(grade),
      class_no: Number(class_no),
      number: Number(number),
    });
  }
  return { rows, errors };
}

export default function StudentManager({
  students,
  hasSecretKey,
}: {
  students: Student[];
  hasSecretKey: boolean;
}) {
  const [csv, setCsv] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [resetInfo, setResetInfo] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = students.filter((s) => {
    const q = query.trim();
    if (!q) return true;
    return (
      s.name.includes(q) ||
      s.student_no.includes(q) ||
      (s.grade != null && `${s.grade}-${s.class_no}-${s.number}`.includes(q))
    );
  });

  function handleImport() {
    const { rows, errors } = parseCsv(csv);
    setParseErrors(errors);
    setResult(null);
    if (rows.length === 0) return;
    startTransition(async () => {
      const r = await importStudents(rows);
      setResult(r);
      setCsv("");
    });
  }

  function handleReset(id: string) {
    startTransition(async () => {
      const r = await resetStudentPassword(id);
      if (r.ok && r.password) {
        setResetInfo((prev) => ({ ...prev, [id]: r.password! }));
      } else {
        setResetInfo((prev) => ({ ...prev, [id]: `실패: ${r.message}` }));
      }
    });
  }

  function downloadRoster() {
    if (!result?.created.length) return;
    const header = "학번,이름,초기비밀번호\n";
    const body = result.created
      .map((c) => `${c.student_no},${c.name},${c.password}`)
      .join("\n");
    const blob = new Blob(["﻿" + header + body], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학생_초기비밀번호_명렬표.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">학생 계정 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            CSV로 학생을 일괄 등록합니다. 학생은 <b>학번 + 초기 비밀번호</b>로
            로그인하며, 최초 로그인 시 비밀번호를 변경하게 됩니다.
          </p>
        </div>
        {hasSecretKey && (
          <ConfirmButton
            action={async () => {
              const r = await promoteStudents();
              setPromoteMsg(r.message);
            }}
            question="전체 재학생을 진급 처리할까요? (3학년→졸업)"
            confirmText="진급"
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            학년 진급
          </ConfirmButton>
        )}
      </div>
      {promoteMsg && (
        <div className="text-sm rounded-lg bg-slate-100 text-slate-700 px-3 py-2">
          {promoteMsg}
        </div>
      )}

      {!hasSecretKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>학생 등록 기능이 비활성 상태입니다.</b> Supabase 대시보드 &gt;
          Project Settings &gt; API Keys에서 <code>secret key</code>를 복사해
          <code> .env.local</code>의 <code>SUPABASE_SECRET_KEY</code>에 넣고 서버를
          재시작하세요.
        </div>
      )}

      {/* CSV 등록 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800">CSV 일괄 등록</h2>
          <button
            onClick={() => setCsv(SAMPLE)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            예시 채우기
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-2">
          형식: 학번,이름,입학년도,학년,반,번호 (첫 줄 헤더 허용)
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          placeholder={SAMPLE}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          disabled={!hasSecretKey}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={!hasSecretKey || isPending || !csv.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPending ? "등록 중..." : "등록"}
          </button>
          {result?.created.length ? (
            <button
              onClick={downloadRoster}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              초기 비밀번호 명렬표 다운로드
            </button>
          ) : null}
        </div>

        {parseErrors.length > 0 && (
          <ul className="mt-3 space-y-1">
            {parseErrors.map((e, i) => (
              <li key={i} className="text-xs text-red-600">
                {e}
              </li>
            ))}
          </ul>
        )}
        {result && (
          <div className="mt-3 text-sm">
            <p className="text-emerald-700">
              {result.created.length}명 등록 완료
              {result.errors.length > 0 &&
                `, ${result.errors.length}건 실패`}
            </p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600">
                {e.student_no}: {e.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 학생 목록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800">
            등록된 학생
            <span className="ml-2 text-xs font-normal text-slate-400">
              {query ? `${filtered.length} / ${students.length}` : students.length}명
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·학번·반 검색"
              className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <CsvExportButton
              filename="학생목록.csv"
              label="목록 CSV"
              headers={["학번", "이름", "학년", "반", "번호", "입학년도", "상태"]}
              rows={filtered.map((s) => [
                s.student_no,
                s.name,
                s.grade,
                s.class_no,
                s.number,
                s.admission_year,
                s.status,
              ])}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">학번</th>
                <th className="px-4 py-2">이름</th>
                <th className="px-4 py-2">학년·반·번호</th>
                <th className="px-4 py-2">입학</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2 text-right">비밀번호</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    {students.length === 0
                      ? "등록된 학생이 없습니다."
                      : "검색 결과가 없습니다."}
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {s.student_no}
                  </td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {s.grade ? `${s.grade}-${s.class_no}-${s.number}` : "-"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {s.admission_year}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{s.status}</td>
                  <td className="px-4 py-2 text-right">
                    {resetInfo[s.id] ? (
                      <span className="text-xs text-emerald-700 font-mono">
                        {resetInfo[s.id]}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleReset(s.id)}
                        disabled={!hasSecretKey || isPending}
                        className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-40"
                      >
                        초기화
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
