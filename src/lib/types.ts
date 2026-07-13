export type SubjectType = "공통" | "일반선택" | "진로선택" | "융합선택" | "창체";

export type Subject = {
  id: string;
  code: string;
  name: string;
  subject_group: string;
  subject_type: SubjectType;
  default_credits: number;
  min_credits: number;
  max_credits: number;
  is_custom: boolean;
  sort_order: number;
};

export type PrerequisiteRule = {
  id: string;
  subject_id: string;
  prerequisite_subject_id: string;
  enforcement: "required" | "recommended";
};

export type CurriculumPlan = {
  id: string;
  admission_year: number;
  status: "draft" | "confirmed";
  updated_at: string;
};

export type CurriculumEntry = {
  id?: string;
  plan_id?: string;
  subject_id: string;
  grade: number;
  semester: number;
  credits: number;
  is_required: boolean;
  choice_group: string | null;
  note?: string | null;
};

export type RoundType = "survey" | "register" | "adjust";

export type EnrollmentRound = {
  id: string;
  name: string;
  academic_year: number;
  target_grade: number;
  semester: number;
  round_type: RoundType;
  opens_at: string;
  closes_at: string;
  max_choices: number | null;
};

export type CourseOffering = {
  id: string;
  academic_year: number;
  semester: number;
  grade: number;
  subject_id: string;
  curriculum_entry_id: string | null;
  credits: number;
  is_required: boolean;
  choice_group: string | null;
  capacity: number;
  min_students: number;
  status: "planned" | "surveying" | "confirmed" | "cancelled";
  band_id?: string | null;
};

export type EnrollmentStatus =
  | "requested"
  | "confirmed"
  | "waitlisted"
  | "cancelled";

export type Enrollment = {
  id: string;
  round_id: string;
  student_id: string;
  offering_id: string;
  status: EnrollmentStatus;
  priority: number | null;
};

export type Room = {
  id: string;
  name: string;
  room_type: "일반교실" | "교과교실" | "특별실";
  subject_group: string | null;
  capacity: number;
};

export type Section = {
  id: string;
  offering_id: string;
  section_no: number;
  teacher_id: string | null;
  room_id: string | null;
  capacity: number;
};

export type SchoolSettings = {
  id: number;
  school_name: string;
  classes_per_grade: number;
  min_credits_per_semester: number;
  max_credits_per_semester: number;
  max_subjects_per_semester: number | null;
  min_students_to_open: number;
  default_section_capacity: number;
  periods_per_day: number;
  days_per_week: number;
};
