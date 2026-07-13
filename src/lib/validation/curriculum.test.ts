import { describe, expect, it } from "vitest";
import type { Subject } from "@/lib/types";
import { validateCurriculum, type EntryInput } from "./curriculum";

// 테스트 픽스처: 과목 코드 → [교과군, 기본학점, min, max]
const SUBJECT_DEFS: Record<string, [string, number, number, number]> = {
  "KOR-C1": ["국어", 4, 3, 4],
  "KOR-C2": ["국어", 4, 3, 4],
  "MAT-C1": ["수학", 4, 3, 4],
  "MAT-C2": ["수학", 4, 3, 4],
  "ENG-C1": ["영어", 4, 3, 4],
  "ENG-C2": ["영어", 4, 3, 4],
  "SOC-KH1": ["사회", 3, 3, 3],
  "SOC-KH2": ["사회", 3, 3, 3],
  "SOC-C1": ["사회", 4, 3, 4],
  "SOC-C2": ["사회", 4, 3, 4],
  "SCI-C1": ["과학", 4, 3, 4],
  "SCI-C2": ["과학", 4, 3, 4],
  "SCI-EX1": ["과학", 1, 1, 1],
  "SCI-EX2": ["과학", 1, 1, 1],
  "KOR-G1": ["국어", 4, 3, 5],
  "KOR-G2": ["국어", 4, 3, 5],
  "KOR-G3": ["국어", 4, 3, 5],
  "KOR-J1": ["국어", 4, 3, 5],
  "KOR-J2": ["국어", 4, 3, 5],
  "MAT-G1": ["수학", 4, 3, 5],
  "MAT-G2": ["수학", 4, 3, 5],
  "MAT-G3": ["수학", 4, 3, 5],
  "MAT-J1": ["수학", 4, 3, 5],
  "MAT-J2": ["수학", 4, 3, 5],
  "MAT-J3": ["수학", 4, 3, 5],
  "ENG-G1": ["영어", 4, 3, 5],
  "ENG-G2": ["영어", 4, 3, 5],
  "ENG-G3": ["영어", 4, 3, 5],
  "ENG-J1": ["영어", 4, 3, 5],
  "ENG-J3": ["영어", 4, 3, 5],
  "SOC-G1": ["사회", 4, 3, 5],
  "SOC-G2": ["사회", 4, 3, 5],
  "SOC-G3": ["사회", 4, 3, 5],
  "SOC-G4": ["사회", 4, 3, 5],
  "SOC-J4": ["사회", 4, 3, 5],
  "SOC-J5": ["사회", 4, 3, 5],
  "SOC-J6": ["사회", 4, 3, 5],
  "SOC-Y1": ["사회", 4, 3, 5],
  "SOC-Y3": ["사회", 4, 3, 5],
  "SCI-G1": ["과학", 4, 3, 5],
  "SCI-G2": ["과학", 4, 3, 5],
  "SCI-G3": ["과학", 4, 3, 5],
  "SCI-G4": ["과학", 4, 3, 5],
  "SCI-J1": ["과학", 4, 3, 5],
  "SCI-J2": ["과학", 4, 3, 5],
  "SCI-J3": ["과학", 4, 3, 5],
  "SCI-J5": ["과학", 4, 3, 5],
  "SCI-J6": ["과학", 4, 3, 5],
  "PE-G1": ["체육", 3, 2, 4],
  "PE-G2": ["체육", 3, 2, 4],
  "PE-J1": ["체육", 3, 2, 4],
  "PE-J2": ["체육", 3, 2, 4],
  "PE-J3": ["체육", 3, 2, 4],
  "PE-Y1": ["체육", 3, 2, 4],
  "ART-G1": ["예술", 3, 2, 4],
  "ART-G2": ["예술", 3, 2, 4],
  "ART-J1": ["예술", 3, 2, 4],
  "ART-J2": ["예술", 3, 2, 4],
  "ART-J3": ["예술", 3, 2, 4],
  "ART-J4": ["예술", 3, 2, 4],
  "TEC-G1": ["기술·가정", 4, 3, 5],
  "INF-G1": ["정보", 4, 3, 5],
  "L2-G4": ["제2외국어", 4, 3, 5],
  "L2-G5": ["제2외국어", 4, 3, 5],
  "L2-J12": ["제2외국어", 4, 3, 5],
  "L2-J13": ["제2외국어", 4, 3, 5],
  "HAN-G1": ["한문", 4, 3, 5],
  "CCA-1": ["창의적체험활동", 3, 1, 6],
};

const subjectsById: Record<string, Subject> = Object.fromEntries(
  Object.entries(SUBJECT_DEFS).map(([code, [group, credits, min, max]]) => [
    code,
    {
      id: code,
      code,
      name: code,
      subject_group: group,
      subject_type: "일반선택",
      default_credits: credits,
      min_credits: min,
      max_credits: max,
      is_custom: false,
      sort_order: 0,
    },
  ])
);

const R = (
  subject: string,
  grade: number,
  semester: number,
  credits: number
): EntryInput => ({
  subject_id: subject,
  grade,
  semester,
  credits,
  is_required: true,
  choice_group: null,
});

const C = (
  subject: string,
  grade: number,
  semester: number,
  credits: number,
  group: string
): EntryInput => ({
  subject_id: subject,
  grade,
  semester,
  credits,
  is_required: false,
  choice_group: group,
});

/** 규정을 모두 만족하는 3개년 편제표 (학생 1인 총 192학점 = 교과 174 + 창체 18) */
function validPlan(): EntryInput[] {
  return [
    // 1-1 (33학점)
    R("KOR-C1", 1, 1, 4), R("MAT-C1", 1, 1, 4), R("ENG-C1", 1, 1, 4),
    R("SOC-KH1", 1, 1, 3), R("SOC-C1", 1, 1, 4), R("SCI-C1", 1, 1, 4),
    R("SCI-EX1", 1, 1, 1), R("PE-G1", 1, 1, 3), R("ART-G1", 1, 1, 3),
    R("CCA-1", 1, 1, 3),
    // 1-2 (33학점)
    R("KOR-C2", 1, 2, 4), R("MAT-C2", 1, 2, 4), R("ENG-C2", 1, 2, 4),
    R("SOC-KH2", 1, 2, 3), R("SOC-C2", 1, 2, 4), R("SCI-C2", 1, 2, 4),
    R("SCI-EX2", 1, 2, 1), R("PE-G2", 1, 2, 3), R("ART-G2", 1, 2, 3),
    R("CCA-1", 1, 2, 3),
    // 2-1 (33학점): 지정 22 + 택1 11
    R("KOR-G3", 2, 1, 4), R("MAT-G1", 2, 1, 4), R("ENG-G1", 2, 1, 4),
    R("INF-G1", 2, 1, 4), R("PE-J1", 2, 1, 3), R("CCA-1", 2, 1, 3),
    C("SOC-G1", 2, 1, 4, "사회탐구A"), C("SOC-G3", 2, 1, 4, "사회탐구A"),
    C("SCI-G1", 2, 1, 4, "과학탐구A"), C("SCI-G2", 2, 1, 4, "과학탐구A"),
    C("ART-J1", 2, 1, 3, "예술심화A"), C("ART-J3", 2, 1, 3, "예술심화A"),
    // 2-2 (33학점)
    R("KOR-G2", 2, 2, 4), R("MAT-G2", 2, 2, 4), R("ENG-G2", 2, 2, 4),
    R("TEC-G1", 2, 2, 4), R("PE-J2", 2, 2, 3), R("CCA-1", 2, 2, 3),
    C("SOC-G2", 2, 2, 4, "사회탐구B"), C("SOC-G4", 2, 2, 4, "사회탐구B"),
    C("SCI-G3", 2, 2, 4, "과학탐구B"), C("SCI-G4", 2, 2, 4, "과학탐구B"),
    C("ART-J2", 2, 2, 3, "예술심화B"), C("ART-J4", 2, 2, 3, "예술심화B"),
    // 3-1 (30학점)
    R("KOR-G1", 3, 1, 4), R("MAT-G3", 3, 1, 4), R("ENG-G3", 3, 1, 4),
    R("PE-J3", 3, 1, 3), R("CCA-1", 3, 1, 3),
    C("L2-G5", 3, 1, 4, "제2외국어"), C("L2-G4", 3, 1, 4, "제2외국어"),
    C("SOC-J4", 3, 1, 4, "사회진로A"), C("SOC-J5", 3, 1, 4, "사회진로A"), C("SOC-J6", 3, 1, 4, "사회진로A"),
    C("SCI-J1", 3, 1, 4, "과학진로A"), C("SCI-J3", 3, 1, 4, "과학진로A"), C("SCI-J5", 3, 1, 4, "과학진로A"),
    // 3-2 (30학점)
    R("KOR-J1", 3, 2, 4), R("PE-Y1", 3, 2, 3), R("CCA-1", 3, 2, 3),
    C("MAT-J2", 3, 2, 4, "수학진로"), C("MAT-J1", 3, 2, 4, "수학진로"), C("MAT-J3", 3, 2, 4, "수학진로"),
    C("ENG-J3", 3, 2, 4, "영어진로"), C("ENG-J1", 3, 2, 4, "영어진로"),
    C("SOC-Y3", 3, 2, 4, "사회진로B"), C("SOC-Y1", 3, 2, 4, "사회진로B"),
    C("SCI-J2", 3, 2, 4, "과학진로B"), C("SCI-J6", 3, 2, 4, "과학진로B"),
    C("HAN-G1", 3, 2, 4, "한문·제2외심화"), C("L2-J13", 3, 2, 4, "한문·제2외심화"), C("L2-J12", 3, 2, 4, "한문·제2외심화"),
  ];
}

const settings = {
  min_credits_per_semester: 28,
  max_credits_per_semester: 36,
  max_subjects_per_semester: null,
};

// DB 시드와 동일한 핵심 위계 규칙
const prereqRules = [
  { subject_id: "KOR-C2", prerequisite_subject_id: "KOR-C1", enforcement: "required" as const },
  { subject_id: "MAT-C2", prerequisite_subject_id: "MAT-C1", enforcement: "required" as const },
  { subject_id: "MAT-G1", prerequisite_subject_id: "MAT-C2", enforcement: "required" as const },
  { subject_id: "MAT-G2", prerequisite_subject_id: "MAT-C2", enforcement: "required" as const },
  { subject_id: "MAT-G3", prerequisite_subject_id: "MAT-C2", enforcement: "required" as const },
  { subject_id: "MAT-J2", prerequisite_subject_id: "MAT-G2", enforcement: "required" as const },
  { subject_id: "ENG-G1", prerequisite_subject_id: "ENG-C2", enforcement: "required" as const },
  { subject_id: "SCI-J2", prerequisite_subject_id: "SCI-G1", enforcement: "recommended" as const },
  { subject_id: "L2-J13", prerequisite_subject_id: "L2-G5", enforcement: "recommended" as const },
];

function run(entries: EntryInput[]) {
  return validateCurriculum({ entries, subjectsById, settings, prereqRules });
}

describe("validateCurriculum", () => {
  it("규정을 만족하는 편제표는 오류·경고가 없다", () => {
    const { issues, summary } = run(validPlan());
    expect(issues).toEqual([]);
    expect(summary.totalCredits).toBe(192);
    expect(summary.subjectCredits).toBe(174);
    expect(summary.ccaCredits).toBe(18);
    expect(summary.korMatEngCredits).toBe(72);
    expect(summary.koreanHistoryCredits).toBe(6);
  });

  it("한국사 학점 위반(3 외 값)을 잡는다", () => {
    const entries = validPlan().map((e) =>
      e.subject_id === "SOC-KH1" ? { ...e, credits: 4 } : e
    );
    const { issues } = run(entries);
    expect(issues.some((i) => i.rule === "credit-range")).toBe(true);
  });

  it("체육 미편성 학기를 잡는다", () => {
    const entries = validPlan().filter((e) => e.subject_id !== "PE-J1");
    const { issues } = run(entries);
    expect(
      issues.some((i) => i.rule === "pe-every-semester" && i.level === "error")
    ).toBe(true);
  });

  it("국·수·영 81학점 상한 초과를 잡는다", () => {
    const entries = [
      ...validPlan(),
      R("KOR-J2", 3, 2, 4), // 국어 지정과목 추가 → 국수영 76
      { ...R("KOR-G1", 2, 2, 4), subject_id: "KOR-G1" }, // 중복 편성으로 +4 → 80
      R("ENG-J1", 2, 1, 4), // +4 → 84 > 81
    ];
    const { issues } = run(entries);
    expect(issues.some((i) => i.rule === "kme-81")).toBe(true);
  });

  it("선수과목 순서 위반(미적분Ⅱ를 미적분Ⅰ과 같은 학기 이전에 편성)을 잡는다", () => {
    const entries = validPlan().map((e) =>
      e.subject_id === "MAT-J2" ? { ...e, grade: 2, semester: 2 } : e
    );
    const { issues } = run(entries);
    expect(
      issues.some((i) => i.rule === "prerequisite-order" && i.level === "error")
    ).toBe(true);
  });

  it("recommended 위계 위반은 경고로 처리한다", () => {
    // 심화 일본어(3-2)의 선수 일본어(3-1)를 제거 → recommended 경고
    const entries = validPlan().filter((e) => e.subject_id !== "L2-G5");
    const { issues } = run(entries);
    const hit = issues.filter((i) => i.rule === "prerequisite-order");
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.every((i) => i.level === "warn")).toBe(true);
  });

  it("택1 그룹 내 학점 불일치를 경고한다", () => {
    const entries = validPlan().map((e) =>
      e.subject_id === "SOC-G3" ? { ...e, credits: 3 } : e
    );
    const { issues } = run(entries);
    expect(issues.some((i) => i.rule === "choice-credit-mismatch")).toBe(true);
  });

  it("미분류(지정도 택1도 아닌) 과목을 경고한다", () => {
    const entries = validPlan().map((e) =>
      e.subject_id === "SOC-G1" ? { ...e, choice_group: null } : e
    );
    const { issues } = run(entries);
    expect(issues.some((i) => i.rule === "unclassified")).toBe(true);
  });

  it("총 학점 미달을 잡는다", () => {
    const entries = validPlan().filter((e) => e.subject_id !== "KOR-J1");
    const { issues } = run(entries);
    expect(issues.some((i) => i.rule === "total-192")).toBe(true);
    expect(issues.some((i) => i.rule === "subject-174")).toBe(true);
  });

  it("폐강 기준: 예상 인원 대비 택1 대안이 많으면 폐강 위험 경고", () => {
    // 학년 예상 인원 = 2학급 × 3명 = 6명, 폐강 기준 13명 → 대안 2개면 대안당 3명 < 13
    const small = {
      ...settings,
      min_students_to_open: 13,
      classes_per_grade: 2,
      default_section_capacity: 3,
    };
    const { issues } = validateCurriculum({
      entries: validPlan(),
      subjectsById,
      settings: small,
      prereqRules,
    });
    expect(issues.some((i) => i.rule === "choice-closure-risk")).toBe(true);
  });

  it("폐강 기준: 학년 인원이 충분하면 폐강 위험 경고 없음", () => {
    const big = {
      ...settings,
      min_students_to_open: 13,
      classes_per_grade: 10,
      default_section_capacity: 30,
    };
    const { issues } = validateCurriculum({
      entries: validPlan(),
      subjectsById,
      settings: big,
      prereqRules,
    });
    expect(issues.some((i) => i.rule === "choice-closure-risk")).toBe(false);
  });

  it("폐강 기준 설정이 없으면 해당 검사를 생략한다", () => {
    // 기존 settings(폐강 필드 없음) → choice-closure-risk 미발생
    const { issues } = run(validPlan());
    expect(issues.some((i) => i.rule === "choice-closure-risk")).toBe(false);
  });
});
