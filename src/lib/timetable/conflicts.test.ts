import { describe, expect, it } from "vitest";
import { findConflicts, type MeetingRecord } from "./conflicts";

const m = (over: Partial<MeetingRecord>): MeetingRecord => ({
  section_id: "s",
  day: 1,
  period: 1,
  room_id: null,
  teacher_id: null,
  subject_name: "과목",
  student_ids: [],
  ...over,
});

describe("findConflicts", () => {
  it("충돌이 없으면 빈 배열", () => {
    const conflicts = findConflicts([
      m({ section_id: "a", day: 1, period: 1, student_ids: ["s1"] }),
      m({ section_id: "b", day: 1, period: 2, student_ids: ["s1"] }),
    ]);
    expect(conflicts).toEqual([]);
  });

  it("같은 학생이 같은 교시에 두 과목이면 학생 충돌", () => {
    const conflicts = findConflicts([
      m({ section_id: "a", subject_name: "물리", student_ids: ["s1"] }),
      m({ section_id: "b", subject_name: "화학", student_ids: ["s1"] }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("student");
    expect(conflicts[0].day).toBe(1);
    expect(conflicts[0].period).toBe(1);
  });

  it("같은 교사가 같은 교시에 두 분반이면 교사 충돌 — day/period 정확", () => {
    // UUID처럼 하이픈이 포함된 식별자로도 day/period가 깨지지 않아야 함(회귀 방지)
    const tid = "18a7f711-3604-45f4-8804-61a3e29e97f2";
    const conflicts = findConflicts([
      m({ section_id: "a", day: 3, period: 4, teacher_id: tid, subject_name: "물리" }),
      m({ section_id: "b", day: 3, period: 4, teacher_id: tid, subject_name: "화학" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("teacher");
    expect(conflicts[0].day).toBe(3);
    expect(conflicts[0].period).toBe(4);
    expect(Number.isNaN(conflicts[0].period)).toBe(false);
  });

  it("같은 강의실이 같은 교시에 두 분반이면 강의실 충돌 — day/period 정확", () => {
    const rid = "31765a71-ff2d-4769-b1a7-18924895fc70";
    const conflicts = findConflicts([
      m({ section_id: "a", day: 5, period: 7, room_id: rid, subject_name: "국어" }),
      m({ section_id: "b", day: 5, period: 7, room_id: rid, subject_name: "수학" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("room");
    expect(conflicts[0].day).toBe(5);
    expect(conflicts[0].period).toBe(7);
  });

  it("여러 학생이 같은 충돌을 만들어도 1건으로 중복 제거", () => {
    const conflicts = findConflicts([
      m({ section_id: "a", subject_name: "물리", student_ids: ["s1", "s2", "s3"] }),
      m({ section_id: "b", subject_name: "화학", student_ids: ["s1", "s2", "s3"] }),
    ]);
    expect(conflicts.filter((c) => c.kind === "student")).toHaveLength(1);
  });

  it("같은 밴드(같은 슬롯) 다른 과목이라도 학생이 안 겹치면 학생충돌 없음", () => {
    const conflicts = findConflicts([
      m({ section_id: "a", subject_name: "세계지리", student_ids: ["s1"] }),
      m({ section_id: "b", subject_name: "사회문화", student_ids: ["s2"] }),
    ]);
    expect(conflicts.filter((c) => c.kind === "student")).toEqual([]);
  });
});
