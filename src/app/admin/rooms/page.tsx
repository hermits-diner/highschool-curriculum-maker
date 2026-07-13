import { addRoom, deleteRoom } from "@/app/actions/sections";
import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";
import ConfirmButton from "@/components/ConfirmButton";

const GROUPS = [
  "국어",
  "수학",
  "영어",
  "사회",
  "과학",
  "체육",
  "예술",
  "기술·가정",
  "정보",
  "제2외국어",
  "한문",
  "교양",
];

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("*").order("name");
  const rooms = (data ?? []) as Room[];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">강의실 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          교과교실제 이동수업에 사용할 강의실을 등록합니다. 교과(군)을 지정하면
          학생·교사가 교과별 강의실을 조회할 수 있습니다.
        </p>
      </div>

      <form
        action={addRoom}
        className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            강의실 이름
          </label>
          <input
            name="name"
            required
            placeholder="예: 3층 과학교실1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            유형
          </label>
          <select
            name="room_type"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option>일반교실</option>
            <option>교과교실</option>
            <option>특별실</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            교과(군)
          </label>
          <select
            name="subject_group"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">(없음)</option>
            {GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            수용
          </label>
          <input
            name="capacity"
            type="number"
            defaultValue={30}
            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          추가
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">유형</th>
              <th className="px-4 py-2">교과(군)</th>
              <th className="px-4 py-2">수용</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  등록된 강의실이 없습니다.
                </td>
              </tr>
            )}
            {rooms.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {r.name}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.room_type}</td>
                <td className="px-4 py-2 text-slate-600">
                  {r.subject_group ?? "-"}
                </td>
                <td className="px-4 py-2 text-slate-500">{r.capacity}명</td>
                <td className="px-2 py-2 text-right">
                  <ConfirmButton
                    action={deleteRoom.bind(null, r.id)}
                    question="이 강의실을 삭제할까요?"
                    confirmText="삭제"
                  >
                    삭제
                  </ConfirmButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
