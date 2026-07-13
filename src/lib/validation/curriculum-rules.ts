// 2022 개정교육과정 총론(교육부 고시 제2022-33호) 일반계고 편성 규정 상수
// 고시 개정 시 이 파일의 수치만 수정한다.

export const TOTAL_CREDITS = 192; // 졸업 총 학점
export const SUBJECT_CREDITS = 174; // 교과 학점
export const CCA_CREDITS = 18; // 창의적 체험활동 학점

export const KOR_MAT_ENG_MAX = 81; // 국·수·영 이수 학점 합계 상한

export const CCA_GROUP = "창의적체험활동";

/** 교과(군)별 필수 이수 학점 (사회는 한국사 6 포함 14) */
export const REQUIRED_MIN: Record<string, number> = {
  국어: 8,
  수학: 8,
  영어: 8,
  사회: 14,
  과학: 10,
  체육: 10,
  예술: 10,
};

/** 생활·교양 영역 묶음(기술·가정/정보/제2외국어/한문/교양) 필수 이수 학점 */
export const LIVING_BUNDLE_MIN = 16;
export const LIVING_BUNDLE_GROUPS = [
  "기술·가정",
  "정보",
  "제2외국어",
  "한문",
  "교양",
];

/** 한국사 필수 6학점 (증감 불가) — 과목 코드로 식별 */
export const KOREAN_HISTORY_CODES = ["SOC-KH1", "SOC-KH2"];
export const KOREAN_HISTORY_MIN = 6;

/** 체육은 매 학기 편성 원칙 */
export const PE_GROUP = "체육";

export const SEMESTERS: Array<{ grade: number; semester: number }> = [
  { grade: 1, semester: 1 },
  { grade: 1, semester: 2 },
  { grade: 2, semester: 1 },
  { grade: 2, semester: 2 },
  { grade: 3, semester: 1 },
  { grade: 3, semester: 2 },
];

export const semesterIndex = (grade: number, semester: number) =>
  (grade - 1) * 2 + (semester - 1);

export const semesterLabel = (grade: number, semester: number) =>
  `${grade}-${semester}`;
