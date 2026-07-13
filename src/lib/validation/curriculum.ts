import type { CurriculumEntry, PrerequisiteRule, Subject } from "@/lib/types";
import {
  CCA_CREDITS,
  CCA_GROUP,
  KOR_MAT_ENG_MAX,
  KOREAN_HISTORY_CODES,
  KOREAN_HISTORY_MIN,
  LIVING_BUNDLE_GROUPS,
  LIVING_BUNDLE_MIN,
  PE_GROUP,
  REQUIRED_MIN,
  SEMESTERS,
  SUBJECT_CREDITS,
  TOTAL_CREDITS,
  semesterIndex,
  semesterLabel,
} from "./curriculum-rules";

export type ValidationIssue = {
  level: "error" | "warn";
  rule: string;
  message: string;
};

export type EntryInput = Pick<
  CurriculumEntry,
  "subject_id" | "grade" | "semester" | "credits" | "is_required" | "choice_group"
>;

export type ValidationSettings = {
  min_credits_per_semester: number;
  max_credits_per_semester: number;
  max_subjects_per_semester: number | null;
  // 폐강 기준 자동 반영용 (없으면 해당 검사 생략)
  min_students_to_open?: number;
  classes_per_grade?: number;
  default_section_capacity?: number;
};

export type SemesterSummary = {
  grade: number;
  semester: number;
  /** 학생 1인이 이 학기에 이수하는 학점 (학교지정 전체 + 택1 그룹당 1과목) */
  studentCredits: number;
  /** 학생 1인이 이 학기에 이수하는 과목 수 */
  studentSubjectCount: number;
};

export type GroupSummary = {
  group: string;
  /** 학생 1인 기준 3년 이수 학점 */
  studentCredits: number;
  requiredMin: number | null;
};

export type CurriculumSummary = {
  semesters: SemesterSummary[];
  groups: GroupSummary[];
  totalCredits: number;
  subjectCredits: number;
  ccaCredits: number;
  korMatEngCredits: number;
  livingBundleCredits: number;
  koreanHistoryCredits: number;
};

/**
 * 편제표는 "학생 1인의 이수 경로" 기준으로 계산한다:
 * - 학교지정(is_required) 과목: 전부 이수
 * - 택1 그룹(choice_group): 그룹당 1과목 이수 (그룹 내 학점이 다르면 최소값 채택 + 경고)
 * - 지정도 그룹도 아닌 과목: 계산 제외 + 경고 (편제표에서는 둘 중 하나로 표시해야 함)
 */
export function summarizeCurriculum(
  entries: EntryInput[],
  subjectsById: Record<string, Subject>
): CurriculumSummary {
  const semesters: SemesterSummary[] = SEMESTERS.map((s) => ({
    ...s,
    studentCredits: 0,
    studentSubjectCount: 0,
  }));
  const groupCredits = new Map<string, number>();

  const addCredits = (
    grade: number,
    semester: number,
    group: string,
    credits: number
  ) => {
    const sem = semesters[semesterIndex(grade, semester)];
    sem.studentCredits += credits;
    sem.studentSubjectCount += 1;
    groupCredits.set(group, (groupCredits.get(group) ?? 0) + credits);
  };

  // 학교지정 과목
  for (const e of entries) {
    const subject = subjectsById[e.subject_id];
    if (!subject) continue;
    if (e.is_required) {
      addCredits(e.grade, e.semester, subject.subject_group, e.credits);
    }
  }

  // 택1 그룹: (학기, 그룹명)당 1과목
  const choiceGroups = new Map<string, EntryInput[]>();
  for (const e of entries) {
    if (e.is_required || !e.choice_group?.trim()) continue;
    const key = `${e.grade}-${e.semester}::${e.choice_group.trim()}`;
    const list = choiceGroups.get(key) ?? [];
    list.push(e);
    choiceGroups.set(key, list);
  }
  for (const [, group] of choiceGroups) {
    const minCredits = Math.min(...group.map((e) => e.credits));
    const first = group[0];
    const subject = subjectsById[first.subject_id];
    if (!subject) continue;
    // 그룹 내 과목들의 교과군이 섞일 수 있으므로(탐구 택1 등) 교과군 합산은 최소 학점 과목 기준
    const minEntry = group.find((e) => e.credits === minCredits)!;
    const minSubject = subjectsById[minEntry.subject_id] ?? subject;
    addCredits(first.grade, first.semester, minSubject.subject_group, minCredits);
  }

  const groups: GroupSummary[] = [...groupCredits.entries()]
    .map(([group, credits]) => ({
      group,
      studentCredits: credits,
      requiredMin: REQUIRED_MIN[group] ?? null,
    }))
    .sort((a, b) => a.group.localeCompare(b.group, "ko"));

  const totalCredits = semesters.reduce((s, x) => s + x.studentCredits, 0);
  const ccaCredits = groupCredits.get(CCA_GROUP) ?? 0;
  const korMatEngCredits =
    (groupCredits.get("국어") ?? 0) +
    (groupCredits.get("수학") ?? 0) +
    (groupCredits.get("영어") ?? 0);
  const livingBundleCredits = LIVING_BUNDLE_GROUPS.reduce(
    (s, g) => s + (groupCredits.get(g) ?? 0),
    0
  );

  // 한국사는 학교지정 전제로 entries에서 직접 합산
  const koreanHistoryCredits = entries
    .filter((e) => {
      const sub = subjectsById[e.subject_id];
      return sub && KOREAN_HISTORY_CODES.includes(sub.code) && e.is_required;
    })
    .reduce((s, e) => s + e.credits, 0);

  return {
    semesters,
    groups,
    totalCredits,
    subjectCredits: totalCredits - ccaCredits,
    ccaCredits,
    korMatEngCredits,
    livingBundleCredits,
    koreanHistoryCredits,
  };
}

export function validateCurriculum(input: {
  entries: EntryInput[];
  subjectsById: Record<string, Subject>;
  settings: ValidationSettings;
  prereqRules: Pick<
    PrerequisiteRule,
    "subject_id" | "prerequisite_subject_id" | "enforcement"
  >[];
}): { issues: ValidationIssue[]; summary: CurriculumSummary } {
  const { entries, subjectsById, settings, prereqRules } = input;
  const issues: ValidationIssue[] = [];
  const summary = summarizeCurriculum(entries, subjectsById);
  const name = (id: string) => subjectsById[id]?.name ?? "(알 수 없는 과목)";

  // 0. 미분류 과목 (지정도 택1 그룹도 아님)
  for (const e of entries) {
    if (!e.is_required && !e.choice_group?.trim()) {
      issues.push({
        level: "warn",
        rule: "unclassified",
        message: `${semesterLabel(e.grade, e.semester)} 「${name(e.subject_id)}」: 학교지정 또는 택1 그룹 중 하나로 표시해야 학점 계산에 포함됩니다.`,
      });
    }
  }

  // 0-1. 택1 그룹 내 학점 불일치
  const choiceGroups = new Map<string, EntryInput[]>();
  for (const e of entries) {
    if (e.is_required || !e.choice_group?.trim()) continue;
    const key = `${e.grade}-${e.semester}::${e.choice_group.trim()}`;
    (choiceGroups.get(key) ?? choiceGroups.set(key, []).get(key)!).push(e);
  }
  for (const [key, group] of choiceGroups) {
    const creditSet = new Set(group.map((e) => e.credits));
    if (creditSet.size > 1) {
      issues.push({
        level: "warn",
        rule: "choice-credit-mismatch",
        message: `택1 그룹 「${key.split("::")[1]}」(${key.split("::")[0]}) 안의 과목 학점이 서로 다릅니다 (${[...creditSet].join(", ")}). 최소값으로 계산합니다.`,
      });
    }
    if (group.length === 1) {
      issues.push({
        level: "warn",
        rule: "choice-single",
        message: `택1 그룹 「${key.split("::")[1]}」(${key.split("::")[0]})에 과목이 1개뿐입니다.`,
      });
    }
  }

  // 0-2. 폐강 기준 자동 반영: 택1 그룹 대안 수가 예상 인원 대비 많으면 일부 폐강 위험
  const minOpen = settings.min_students_to_open ?? 0;
  const cohort =
    (settings.classes_per_grade ?? 0) * (settings.default_section_capacity ?? 0);
  if (minOpen > 0 && cohort > 0) {
    for (const [key, group] of choiceGroups) {
      const alternatives = group.length;
      if (alternatives < 2) continue;
      const perAlt = Math.floor(cohort / alternatives);
      if (perAlt < minOpen) {
        const [gs, gname] = key.split("::");
        issues.push({
          level: "warn",
          rule: "choice-closure-risk",
          message: `택1 그룹 「${gname}」(${gs}): 대안 ${alternatives}과목 · 학년 예상 ${cohort}명이면 균등 선택 시 대안당 약 ${perAlt}명으로 폐강 기준(${minOpen}명) 미달 위험. 폐강 없이 모두 개설하려면 학년 인원이 약 ${alternatives * minOpen}명 이상이어야 합니다.`,
        });
      }
    }
  }

  // 1. 총 학점
  if (summary.totalCredits !== TOTAL_CREDITS) {
    issues.push({
      level: "error",
      rule: "total-192",
      message: `총 이수 학점이 ${summary.totalCredits}학점입니다 (기준 ${TOTAL_CREDITS}학점).`,
    });
  }
  if (summary.subjectCredits !== SUBJECT_CREDITS) {
    issues.push({
      level: "error",
      rule: "subject-174",
      message: `교과 학점이 ${summary.subjectCredits}학점입니다 (기준 ${SUBJECT_CREDITS}학점).`,
    });
  }
  if (summary.ccaCredits !== CCA_CREDITS) {
    issues.push({
      level: "error",
      rule: "cca-18",
      message: `창의적 체험활동이 ${summary.ccaCredits}학점입니다 (기준 ${CCA_CREDITS}학점).`,
    });
  }

  // 2. 교과(군)별 필수 이수 학점
  for (const [group, min] of Object.entries(REQUIRED_MIN)) {
    const got =
      summary.groups.find((g) => g.group === group)?.studentCredits ?? 0;
    if (got < min) {
      issues.push({
        level: "error",
        rule: `required-${group}`,
        message: `${group} 교과(군) 이수 학점 ${got}학점이 필수 이수 기준 ${min}학점에 미달합니다.`,
      });
    }
  }
  if (summary.livingBundleCredits < LIVING_BUNDLE_MIN) {
    issues.push({
      level: "error",
      rule: "required-living",
      message: `기술·가정/정보/제2외국어/한문/교양 이수 학점 ${summary.livingBundleCredits}학점이 필수 이수 기준 ${LIVING_BUNDLE_MIN}학점에 미달합니다.`,
    });
  }
  if (summary.koreanHistoryCredits < KOREAN_HISTORY_MIN) {
    issues.push({
      level: "error",
      rule: "required-korean-history",
      message: `한국사가 ${summary.koreanHistoryCredits}학점입니다 (필수 ${KOREAN_HISTORY_MIN}학점, 학교지정 편성 필요).`,
    });
  }

  // 3. 국·수·영 상한
  if (summary.korMatEngCredits > KOR_MAT_ENG_MAX) {
    issues.push({
      level: "error",
      rule: "kme-81",
      message: `국어·수학·영어 이수 학점 합계 ${summary.korMatEngCredits}학점이 상한 ${KOR_MAT_ENG_MAX}학점을 초과합니다.`,
    });
  }

  // 4. 체육 매 학기 편성
  for (const { grade, semester } of SEMESTERS) {
    const hasPE = entries.some((e) => {
      const sub = subjectsById[e.subject_id];
      return (
        sub &&
        sub.subject_group === PE_GROUP &&
        e.grade === grade &&
        e.semester === semester
      );
    });
    if (!hasPE) {
      issues.push({
        level: "error",
        rule: "pe-every-semester",
        message: `${semesterLabel(grade, semester)}학기에 체육 교과가 편성되지 않았습니다 (체육은 매 학기 편성).`,
      });
    }
  }

  // 5. 과목별 학점 증감 범위
  for (const e of entries) {
    const sub = subjectsById[e.subject_id];
    if (!sub) continue;
    if (e.credits < sub.min_credits || e.credits > sub.max_credits) {
      issues.push({
        level: "error",
        rule: "credit-range",
        message: `${semesterLabel(e.grade, e.semester)} 「${sub.name}」 ${e.credits}학점은 허용 범위(${sub.min_credits}~${sub.max_credits})를 벗어납니다.`,
      });
    }
  }

  // 6. 학기당 이수 학점·과목 수 (경고)
  for (const sem of summary.semesters) {
    if (
      sem.studentCredits > 0 &&
      (sem.studentCredits < settings.min_credits_per_semester ||
        sem.studentCredits > settings.max_credits_per_semester)
    ) {
      issues.push({
        level: "warn",
        rule: "semester-credits",
        message: `${semesterLabel(sem.grade, sem.semester)}학기 이수 학점이 ${sem.studentCredits}학점입니다 (학교 기준 ${settings.min_credits_per_semester}~${settings.max_credits_per_semester}학점).`,
      });
    }
    if (
      settings.max_subjects_per_semester != null &&
      sem.studentSubjectCount > settings.max_subjects_per_semester
    ) {
      issues.push({
        level: "warn",
        rule: "semester-subjects",
        message: `${semesterLabel(sem.grade, sem.semester)}학기 이수 과목이 ${sem.studentSubjectCount}과목입니다 (학교 기준 ${settings.max_subjects_per_semester}과목 이내).`,
      });
    }
  }

  // 7. 선수과목(위계) 순서
  const earliestPlacement = new Map<string, number>();
  for (const e of entries) {
    const idx = semesterIndex(e.grade, e.semester);
    const cur = earliestPlacement.get(e.subject_id);
    if (cur === undefined || idx < cur) earliestPlacement.set(e.subject_id, idx);
  }
  for (const rule of prereqRules) {
    const subjectIdx = earliestPlacement.get(rule.subject_id);
    const prereqIdx = earliestPlacement.get(rule.prerequisite_subject_id);
    if (subjectIdx === undefined) continue; // 대상 과목 미편성이면 통과
    if (prereqIdx === undefined || prereqIdx >= subjectIdx) {
      issues.push({
        level: rule.enforcement === "required" ? "error" : "warn",
        rule: "prerequisite-order",
        message: `「${name(rule.subject_id)}」은(는) 「${name(rule.prerequisite_subject_id)}」 이수 후 편성해야 합니다${prereqIdx === undefined ? " (선수과목 미편성)" : ""}.`,
      });
    }
  }

  return { issues, summary };
}
