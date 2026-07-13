"use client";

import { useState, useTransition } from "react";
import type { CourseOffering, Subject } from "@/lib/types";
import {
  setOfferingStatus,
  updateOfferingCapacity,
} from "@/app/actions/rounds";
import ConfirmButton from "@/components/ConfirmButton";

type Demand = { demand: number; confirmed: number; waitlisted: number };

const STATUS_LABEL: Record<string, string> = {
  planned: "계획",
  surveying: "조사중",
  confirmed: "개설확정",
  cancelled: "폐강",
};

export default function OfferingsPanel({
  offerings,
  subjectsById,
  roundId,
  roundType,
  demandByKey,
}: {
  offerings: CourseOffering[];
  subjectsById: Record<string, Subject>;
  roundId: string;
  roundType: string;
  demandByKey: Record<string, Demand>;
}) {
  const [isPending, startTransition] = useTransition();

  if (offerings.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">
        이 기간에 해당하는 개설과목이 없습니다. 위에서 개설과목을 먼저
        생성하세요.
      </p>
    );
  }

  // 선택과목만 수요 집계 대상으로 표시(지정과목은 전원 이수)
  const electives = offerings
    .filter((o) => !o.is_required)
    .sort((a, b) => {
      const ga = a.choice_group ?? "";
      const gb = b.choice_group ?? "";
      if (ga !== gb) return ga.localeCompare(gb, "ko");
      return (
        (subjectsById[a.subject_id]?.sort_order ?? 0) -
        (subjectsById[b.subject_id]?.sort_order ?? 0)
      );
    });
  const requiredCount = offerings.length - electives.length;

  return (
    <div>
      {requiredCount > 0 && (
        <p className="text-xs text-slate-400 mb-2">
          학교지정 {requiredCount}과목은 전원 이수(신청 불필요)로 표시에서
          제외했습니다.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1.5">택1 그룹</th>
              <th className="px-2 py-1.5">과목</th>
              <th className="px-2 py-1.5 text-center">수요</th>
              {roundType !== "survey" && (
                <>
                  <th className="px-2 py-1.5 text-center">확정</th>
                  <th className="px-2 py-1.5 text-center">대기</th>
                </>
              )}
              <th className="px-2 py-1.5 text-center">정원</th>
              <th className="px-2 py-1.5 text-center">최소</th>
              <th className="px-2 py-1.5">상태</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {electives.map((o) => {
              const d = demandByKey[o.id] ?? {
                demand: 0,
                confirmed: 0,
                waitlisted: 0,
              };
              const belowMin = d.demand < o.min_students;
              return (
                <OfferingRow
                  key={o.id}
                  offering={o}
                  subject={subjectsById[o.subject_id]}
                  demand={d}
                  belowMin={belowMin}
                  roundType={roundType}
                  isPending={isPending}
                  onStatus={(status) =>
                    startTransition(() => setOfferingStatus(o.id, status))
                  }
                  onCapacity={(cap) =>
                    startTransition(async () => {
                      await updateOfferingCapacity(o.id, cap);
                    })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfferingRow({
  offering,
  subject,
  demand,
  belowMin,
  roundType,
  isPending,
  onStatus,
  onCapacity,
}: {
  offering: CourseOffering;
  subject: Subject | undefined;
  demand: Demand;
  belowMin: boolean;
  roundType: string;
  isPending: boolean;
  onStatus: (status: string) => void;
  onCapacity: (cap: number) => void;
}) {
  const [cap, setCap] = useState(offering.capacity);

  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 text-xs text-slate-500">
        {offering.choice_group ?? "-"}
      </td>
      <td className="px-2 py-1.5 font-medium text-slate-800">
        {subject?.name}
        <span className="ml-1 text-xs text-slate-400">
          {offering.credits}학점
        </span>
      </td>
      <td
        className={`px-2 py-1.5 text-center tabular-nums font-medium ${
          belowMin ? "text-red-600" : "text-slate-700"
        }`}
        title={belowMin ? "최소 개설 인원 미달" : ""}
      >
        {demand.demand}
      </td>
      {roundType !== "survey" && (
        <>
          <td className="px-2 py-1.5 text-center tabular-nums text-emerald-700">
            {demand.confirmed}
          </td>
          <td className="px-2 py-1.5 text-center tabular-nums text-amber-600">
            {demand.waitlisted}
          </td>
        </>
      )}
      <td className="px-2 py-1.5 text-center">
        <input
          type="number"
          value={cap}
          min={1}
          onChange={(e) => setCap(Number(e.target.value))}
          onBlur={() => cap !== offering.capacity && onCapacity(cap)}
          disabled={isPending}
          className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs text-center"
        />
      </td>
      <td className="px-2 py-1.5 text-center text-xs text-slate-400">
        {offering.min_students}
      </td>
      <td className="px-2 py-1.5">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            offering.status === "cancelled"
              ? "bg-red-50 text-red-600"
              : offering.status === "confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {STATUS_LABEL[offering.status]}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        {offering.status !== "cancelled" ? (
          <>
            {offering.status !== "confirmed" && (
              <button
                onClick={() => onStatus("confirmed")}
                disabled={isPending}
                className="text-xs text-emerald-600 hover:text-emerald-700 mr-2"
              >
                개설확정
              </button>
            )}
            <ConfirmButton
              action={() => onStatus("cancelled")}
              question="폐강할까요?"
              confirmText="폐강"
              className="text-xs text-red-500 hover:text-red-700"
            >
              폐강
            </ConfirmButton>
          </>
        ) : (
          <button
            onClick={() => onStatus("planned")}
            disabled={isPending}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            되돌리기
          </button>
        )}
      </td>
    </tr>
  );
}
