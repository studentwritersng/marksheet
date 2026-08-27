import { describe, it, expect } from "vitest"; // or "node:test" if project uses that
import { shapeAssessmentScores } from "./shape";

describe("shapeAssessmentScores", () => {
  const codeToLabel = new Map<string, string>([
    ["OBJ", "Objective"],
    ["TH", "Theory"],
    ["PRC", "Practical"],
  ]);

  it("maps codes to labelled components, preserving raw marks", () => {
    const raw = { OBJ: 18, TH: 42, PRC: 15 };
    const out = shapeAssessmentScores(raw, codeToLabel);
    expect(out).toEqual([
      { code: "OBJ", label: "Objective", raw: 18 },
      { code: "TH", label: "Theory", raw: 42 },
      { code: "PRC", label: "Practical", raw: 15 },
    ]);
  });

  it("falls back to the code as label when no mapping exists", () => {
    const out = shapeAssessmentScores({ XYZ: 9 }, codeToLabel);
    expect(out).toEqual([{ code: "XYZ", label: "XYZ", raw: 9 }]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(shapeAssessmentScores(null, codeToLabel)).toEqual([]);
    expect(shapeAssessmentScores(undefined, codeToLabel)).toEqual([]);
  });
});
