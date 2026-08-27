export type CodeLabelMap = Map<string, string>;

export interface AssessmentComponent {
  code: string;
  label: string;
  raw: number;
}

export interface HubSubjectScore {
  subjectId: string;
  subjectName: string;
  totalScore: number | null;
  grade: string | null;
  subjectPosition: number | null;
  components: AssessmentComponent[];
}

export interface HubTermResult {
  termId: string;
  termName: string;
  sessionLabel: string;
  overallAverage: number | null;
  overallPosition: number | null;
  teacherComment: string | null;
  principalComment: string | null;
  subjects: HubSubjectScore[];
  reportCardHref: string;
}

export interface HubHomework {
  id: string;
  title: string;
  subjectName: string;
  dueDate: string | null;
  attemptStatus: string | null;
  score: number | null;
  percentage: number | null;
  published: boolean;
  href: string;
}

export interface HubExam {
  id: string;
  subjectName: string;
  assessmentTypeLabel: string;
  examMark: number | null;
  href: string;
}

export interface HubWard {
  studentId: string;
  name: string;
  className: string;
  admissionNumber: string;
  terms: HubTermResult[];
  homework: HubHomework[];
  exams: HubExam[];
}

export interface AcademicHubData {
  wards: HubWard[];
  termOptions: { id: string; label: string }[];
}

export function shapeAssessmentScores(
  raw: Record<string, number> | null | undefined,
  codeToLabel: CodeLabelMap,
): AssessmentComponent[] {
  if (!raw) return [];
  return Object.entries(raw).map(([code, value]) => ({
    code,
    label: codeToLabel.get(code) ?? code,
    raw: typeof value === "number" ? value : Number(value) || 0,
  }));
}
