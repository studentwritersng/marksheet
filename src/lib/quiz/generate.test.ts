import { describe, it, expect } from "vitest";
import { validateQuizQuestion, classLevelGuidance } from "./generate";

describe("validateQuizQuestion", () => {
  it("accepts a well-formed question", () => {
    const ok = validateQuizQuestion({
      questionText: "What is 2+2?",
      options: ["1", "2", "3", "4"],
      correctIndex: 3,
      difficulty: 1,
    });
    expect(ok).not.toBeNull();
    expect(ok!.points).toBe(10);
  });

  it("rejects wrong option count", () => {
    expect(validateQuizQuestion({
      questionText: "Q?", options: ["a", "b"], correctIndex: 0, difficulty: 1,
    })).toBeNull();
  });

  it("rejects out-of-range correctIndex", () => {
    expect(validateQuizQuestion({
      questionText: "Q?", options: ["a", "b", "c", "d"], correctIndex: 9, difficulty: 1,
    })).toBeNull();
  });

  it("rejects empty question text", () => {
    expect(validateQuizQuestion({
      questionText: "   ", options: ["a", "b", "c", "d"], correctIndex: 0, difficulty: 1,
    })).toBeNull();
  });
});

describe("classLevelGuidance", () => {
  it("returns guidance for every standard level", () => {
    for (const lvl of ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"]) {
      expect(classLevelGuidance(lvl).length).toBeGreaterThan(0);
    }
  });
});
