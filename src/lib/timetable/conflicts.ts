// 시간표 충돌 검증 (학생/교사/강의실 × 요일·교시 중복). 브라우저·서버 공유 순수 함수.

export type MeetingRecord = {
  section_id: string;
  day: number;
  period: number;
  room_id: string | null;
  teacher_id: string | null;
  subject_name: string;
  student_ids: string[];
};

export type Conflict = {
  kind: "student" | "teacher" | "room";
  day: number;
  period: number;
  detail: string;
};

type Bucket = { day: number; period: number; subjects: Set<string> };

/** owner(학생/교사/강의실 식별자) × (요일,교시) 단위로 과목을 모아 2개 이상이면 충돌 */
function collectConflicts(
  buckets: Map<string, Bucket>,
  kind: Conflict["kind"],
  describe: (subjects: string[]) => string
): Conflict[] {
  const out: Conflict[] = [];
  for (const b of buckets.values()) {
    if (b.subjects.size > 1) {
      out.push({
        kind,
        day: b.day,
        period: b.period,
        detail: describe([...b.subjects]),
      });
    }
  }
  return out;
}

function bucketKey(owner: string, day: number, period: number) {
  // owner에 하이픈(UUID)이 있어도 안전하도록 구분자를 명확히 분리해 저장(파싱하지 않고 값으로 day/period 보관)
  return `${owner}@@${day}@@${period}`;
}

export function findConflicts(meetings: MeetingRecord[]): Conflict[] {
  const studentBuckets = new Map<string, Bucket>();
  const teacherBuckets = new Map<string, Bucket>();
  const roomBuckets = new Map<string, Bucket>();

  const add = (
    buckets: Map<string, Bucket>,
    owner: string,
    m: MeetingRecord
  ) => {
    const key = bucketKey(owner, m.day, m.period);
    const b =
      buckets.get(key) ??
      { day: m.day, period: m.period, subjects: new Set<string>() };
    b.subjects.add(m.subject_name);
    buckets.set(key, b);
  };

  for (const m of meetings) {
    for (const sid of m.student_ids) add(studentBuckets, sid, m);
    if (m.teacher_id) add(teacherBuckets, m.teacher_id, m);
    if (m.room_id) add(roomBuckets, m.room_id, m);
  }

  const all = [
    ...collectConflicts(
      studentBuckets,
      "student",
      (subs) => `학생이 같은 시간에 ${subs.join(", ")}을(를) 동시 수강`
    ),
    ...collectConflicts(
      teacherBuckets,
      "teacher",
      (subs) => `교사가 같은 시간에 ${subs.join(", ")} 담당`
    ),
    ...collectConflicts(
      roomBuckets,
      "room",
      (subs) => `강의실이 같은 시간에 ${subs.join(", ")}에 중복 배정`
    ),
  ];

  // 동일 (종류·요일·교시·내용) 중복 제거 (여러 학생이 같은 충돌을 만들 수 있음)
  const seen = new Set<string>();
  return all.filter((c) => {
    const sig = `${c.kind}|${c.day}|${c.period}|${c.detail}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

export const DAY_LABELS = ["", "월", "화", "수", "목", "금", "토"];
