// src/lib/exams/build-child-exams.ts
export interface ComponentInput {
  subAssessmentTypeId: string; // child AssessmentType id
  code: string;                // "OBJ" | "THEORY" | "PRC"
  enabled: boolean;
  allocation: number;          // marks out of parent total
  durationMinutes: number;     // 0 for PRC (manual)
  questionIds: string[];
}
export interface BuildChildExamInput {
  parentHasSubAssessments: boolean;
  parentWeight: number;        // allocations must sum to this
  components: ComponentInput[];
}
export interface ChildExamSpec {
  subAssessmentTypeId: string;
  durationMinutes: number;
  allocation: number;
  questionIds: string[];
}

export function buildChildExamSpecs(input: BuildChildExamInput): ChildExamSpec[] {
  const { parentHasSubAssessments, parentWeight, components } = input;
  if (!parentHasSubAssessments) return [];

  const enabled = components.filter((c) => c.enabled);
  if (enabled.length === 0) return [];

  const platform = enabled.filter((c) => c.code === "OBJ" || c.code === "THEORY");
  const sum = enabled.reduce((s, c) => s + (Number(c.allocation) || 0), 0);
  if (Math.abs(sum - parentWeight) > 0.01) {
    throw new Error(`Component marks must sum to ${parentWeight}`);
  }

  for (const c of platform) {
    if ((Number(c.allocation) || 0) <= 0) throw new Error(`${c.code} must have marks > 0`);
    if ((Number(c.durationMinutes) || 0) <= 0) throw new Error(`${c.code} requires a duration > 0`);
    if (c.questionIds.length === 0) throw new Error(`${c.code} requires at least one question`);
  }
  for (const c of enabled.filter((x) => x.code === "PRC")) {
    if ((Number(c.allocation) || 0) <= 0) throw new Error("PRC must have marks > 0");
  }

  return enabled.map((c) => ({
    subAssessmentTypeId: c.subAssessmentTypeId,
    durationMinutes: Math.max(0, Math.round(Number(c.durationMinutes) || 0)),
    allocation: Number(c.allocation) || 0,
    questionIds: c.code === "PRC" ? [] : c.questionIds,
  }));
}
