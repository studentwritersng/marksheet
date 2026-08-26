import { describe, it, expect } from "vitest";
import { autoGradeMcq, validateQuestionCounts, computeTotals, type McqOption } from "./grading";

const opts: McqOption[] = [
  { text: "A", isCorrect: false },
  { text: "B", isCorrect: true },
  { text: "C", isCorrect: false },
  { text: "D", isCorrect: false },
];

describe("autoGradeMcq", () => {
  it("marks correct selection", () => {
    expect(autoGradeMcq(1, opts)).toEqual({ correct: true, scoreFactor: 1 });
  });
  it("marks wrong selection", () => {
    expect(autoGradeMcq(0, opts)).toEqual({ correct: false, scoreFactor: 0 });
  });
  it("marks null as wrong", () => {
    expect(autoGradeMcq(null, opts)).toEqual({ correct: false, scoreFactor: 0 });
  });
});

describe("validateQuestionCounts", () => {
  it("passes within limits", () => {
    expect(() => validateQuestionCounts(20, 5)).not.toThrow();
  });
  it("rejects too many mcq", () => {
    expect(() => validateQuestionCounts(21, 1)).toThrow(/MCQ/);
  });
  it("rejects too many essays", () => {
    expect(() => validateQuestionCounts(5, 6)).toThrow(/Essay/);
  });
});

describe("computeTotals", () => {
  it("computes percentage rounded to 1dp", () => {
    expect(computeTotals(8, 2, 20)).toEqual({ totalScore: 10, percentage: 50 });
  });
  it("handles zero total marks", () => {
    expect(computeTotals(0, 0, 0)).toEqual({ totalScore: 0, percentage: 0 });
  });
});
