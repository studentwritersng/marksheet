// src/lib/results/scoring.test.ts
import { describe, it, expect } from "vitest";
import { scaleToAllocation, scaleManual } from "./scoring";

describe("scaleToAllocation", () => {
  it("scales a component score to its allocated marks", () => {
    // THEORY allocated 60, student scored 45/75 on the THEORY bank
    expect(scaleToAllocation(45, 75, 60)).toBeCloseTo(36, 6);
  });
  it("returns 0 when the bank max is 0", () => {
    expect(scaleToAllocation(10, 0, 60)).toBe(0);
  });
  it("returns full allocation when perfect", () => {
    expect(scaleToAllocation(75, 75, 60)).toBeCloseTo(60, 6);
  });
});

describe("scaleManual", () => {
  it("scales a manual raw to its allocated marks", () => {
    // PRC allocated 20, teacher entered 15/20
    expect(scaleManual(15, 20, 20)).toBeCloseTo(15, 6);
  });
  it("returns 0 when manual max is 0", () => {
    expect(scaleManual(15, 0, 20)).toBe(0);
  });
});
