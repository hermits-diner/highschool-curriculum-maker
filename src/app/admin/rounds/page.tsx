import { createClient } from "@/lib/supabase/server";
import { createRound, deleteRound, generateOfferings } from "@/app/actions/rounds";
import type {
  CourseOffering,
  CurriculumPlan,
  EnrollmentRound,
  Subject,
} from "@/lib/types";
import OfferingsPanel from "./OfferingsPanel";
import ConfirmButton from "@/components/ConfirmButton";

const ROUND_TYPE_LABEL: Record<string, string> = {
  survey: "수요조사",
  register: "정식 신청",
  adjust: "정정",
};

function fmt(dt: string) {
  const d = new Date(dt);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function RoundsPage() {
  const supabase = await createClient();
  const [
    { data: plans },
    { data: rounds },
    { data: offerings },
    { data: subjects },
    { data: demand },
  ] = await Promise.all([
    supabase
      .from("curriculum_plans")
      .select("*")
      .order("admission_year", { ascending: false }),
    supabase
      .from("enrollment_rounds")
      .select("*")
      .order("opens_at", { ascending: false }),
    supabase.from("course_offerings").select("*"),
    supabase.from("subjects").select("*"),
    supabase.from("v_offering_demand").select("*"),
  ]);

  const confirmedPlans = ((plans ?? []) as CurriculumPlan[]).filter(
    (p) => p.status === "confirmed"
  );
  const subjectsById = Object.fromEntries(
    ((subjects ?? []) as Subject[]).map((s) => [s.id, s])
  );
  const demandByKey = new Map<string, { demand: number; confirmed: number; waitlisted: number }>();
  for (const d of (demand ?? []) as Array<{
    round_id: string;
    offering_id: string;
    demand: number;
    confirmed_count: number;
    waitlisted_count: number;
  }>) {
    demandByKey.set(`${d.round_id}:${d.offering_id}`, {
      demand: d.demand,
      confirmed: d.confirmed_count,
      waitlisted: d.waitlisted_count,
    });
  }

  const allOfferings = (offerings ?? []) as CourseOffering[];
  const now = new Date();

  // 라운드별 미완료 학생 수 (택1 그룹마다 1과목 미선택)
  const incompleteByRound = new Map<string, number>();
  await Promise.all(
    ((rounds ?? []) as EnrollmentRound[]).map(async (r) => {
      const { data } = await supabase.rpc("round_incomplete_count", {
        p_round_id: r.id,
      });
      incompleteByRound.set(r.id, (data as number) ?? 0);
    })
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          수요조사 · 수강신청
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          확정된 편제표에서 개설과목을 생성하고, 수요조사·정식신청 기간을
          운영합니다.
        </p>
      </div>

      {/* 개설과목 생성 */}
      <section>
        <h2 className="font-semibold text-slate-800 mb-2">① 개설과목 생성</h2>
        {confirmedPlans.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            확정된 편제표가 없습니다. 먼저 편제표를 작성·확정하세요.
          </p>
        ) : (
          <form
            action={generateOfferings}
            className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                편제표(입학년도)
              </label>
              <select
                name="admission_year"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                {confirmedPlans.map((p) => (
                  <option key={p.id} value={p.admission_year}>
                    {p.admission_year}학년도 입학생
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                학년
              </label>
              <select
                name="grade"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                {[1, 2, 3].map((g) => (
                  <option key={g} value={g}>
                    {g}학년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                학기
              </label>
              <select
                name="semester"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                {[1, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}학기
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              개설과목 생성
            </button>
          </form>
        )}
      </section>

      {/* 라운드 생성 */}
      <section>
        <h2 className="font-semibold text-slate-800 mb-2">
          ② 수요조사·신청 기간 개설
        </h2>
        <form
          action={createRound}
          className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              이름
            </label>
            <input
              name="name"
              required
              placeholder="예: 2학년 2학기 선택과목 수요조사"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              유형
            </label>
            <select
              name="round_type"
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="survey">수요조사</option>
              <option value="register">정식 신청</option>
              <option value="adjust">정정</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              학년도
            </label>
            <input
              name="academic_year"
              type="number"
              defaultValue={now.getFullYear()}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              대상 학년
            </label>
            <select
              name="target_grade"
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              {[1, 2, 3].map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              학기
            </label>
            <select
              name="semester"
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              {[1, 2].map((s) => (
                <option key={s} value={s}>
                  {s}학기
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              시작 일시
            </label>
            <input
              name="opens_at"
              type="datetime-local"
              required
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              마감 일시
            </label>
            <input
              name="closes_at"
              type="datetime-local"
              required
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              최대 신청 과목 수
            </label>
            <input
              name="max_choices"
              type="number"
              min={1}
              placeholder="제한 없음"
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              기간 개설
            </button>
          </div>
        </form>
      </section>

      {/* 라운드 목록 + 수요 집계 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-800">③ 진행 현황 · 수요 집계</h2>
        {(rounds ?? []).length === 0 && (
          <p className="text-sm text-slate-400 py-4">
            아직 개설된 기간이 없습니다.
          </p>
        )}
        {((rounds ?? []) as EnrollmentRound[]).map((round) => {
          const isOpen =
            now >= new Date(round.opens_at) && now <= new Date(round.closes_at);
          const roundOfferings = allOfferings.filter(
            (o) =>
              o.academic_year === round.academic_year &&
              o.semester === round.semester &&
              o.grade === round.target_grade
          );
          return (
            <div
              key={round.id}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {round.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {ROUND_TYPE_LABEL[round.round_type]}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isOpen
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isOpen ? "진행 중" : "마감/대기"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {round.academic_year}학년도 {round.target_grade}학년{" "}
                    {round.semester}학기 · {fmt(round.opens_at)} ~{" "}
                    {fmt(round.closes_at)}
                    {round.max_choices != null &&
                      ` · 최대 ${round.max_choices}과목`}
                  </p>
                  {(incompleteByRound.get(round.id) ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      미완료 학생 {incompleteByRound.get(round.id)}명 (택1 그룹
                      일부 미선택)
                    </p>
                  )}
                </div>
                <ConfirmButton
                  action={deleteRound.bind(null, round.id)}
                  question="이 기간을 삭제할까요?"
                  confirmText="삭제"
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  삭제
                </ConfirmButton>
              </div>

              <OfferingsPanel
                offerings={roundOfferings}
                subjectsById={subjectsById}
                roundId={round.id}
                roundType={round.round_type}
                demandByKey={Object.fromEntries(
                  roundOfferings.map((o) => [
                    o.id,
                    demandByKey.get(`${round.id}:${o.id}`) ?? {
                      demand: 0,
                      confirmed: 0,
                      waitlisted: 0,
                    },
                  ])
                )}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
