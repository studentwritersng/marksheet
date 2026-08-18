// src/lib/exams/build-child-exams.test.ts
import { describe, it, expect } from "vitest";
import { buildChildExamSpecs, type ComponentInput } from "./build-child-exams";

const base: ComponentInput[] = [
  { subAssessmentTypeId: "obj1", code: "OBJ", enabled: true, allocation: 20, durationMinutes: 20, questionIds: ["q1", "q2"] },
  { subAssessmentTypeId: "th1", code: "THEORY", enabled: true, allocation: 60, durationMinutes: 90, questionIds: ["q3"] },
  { subAssessmentTypeId: "prc1", code: "PRC", enabled: true, allocation: 20, durationMinutes: 0, questionIds: [] },
];

describe("buildChildExamSpecs", () => {
  it("returns one spec per enabled component", () => {
    const specs = buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: base });
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({ subAssessmentTypeId: "obj1", durationMinutes: 20, allocation: 20, questionIds: ["q1", "q2"] });
    expect(specs[2].questionIds).toEqual([]); // PRC has no questions
  });

  it("throws when allocations do not sum to parent weight", () => {
    const bad = base.map((c) => (c.code === "PRC" ? { ...c, allocation: 19 } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/sum/i);
  });

  it("throws when an enabled platform component has no questions", () => {
    const bad = base.map((c) => (c.code === "OBJ" ? { ...c, questionIds: [] } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/question/i);
  });

  it("throws when an enabled platform component has no duration", () => {
    const bad = base.map((c) => (c.code === "THEORY" ? { ...c, durationMinutes: 0 } : c));
    expect(() => buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 100, components: bad }))
      .toThrow(/duration/i);
  });

  it("allows PRC-only (manual) exams", () => {
    const onlyPrc = [base[2]];
    const specs = buildChildExamSpecs({ parentHasSubAssessments: true, parentWeight: 20, components: onlyPrc });
    expect(specs).toHaveLength(1);
    expect(specs[0].subAssessmentTypeId).toBe("prc1");
  });

  it("returns [] when parent has no sub-assessments (legacy single exam)", () => {
    expect(buildChildExamSpecs({ parentHasSubAssessments: false, parentWeight: 0, components: base }))
      .toEqual([]);
  });
});
