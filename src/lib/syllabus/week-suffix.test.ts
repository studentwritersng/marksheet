import { describe, it, expect } from "vitest";
import { assignWeekSuffixes } from "./week-suffix";

describe("assignWeekSuffixes", () => {
  it("keeps a single topic's parsed suffix", () => {
    const out = assignWeekSuffixes([{ week: 1, weekSuffix: "", topic: "T" }]);
    expect(out.map((t) => t.weekSuffix)).toEqual([""]);
  });

  it("gives distinct suffixes to multiple topics in the same week", () => {
    const out = assignWeekSuffixes([
      { week: 1, weekSuffix: "", topic: "A" },
      { week: 1, weekSuffix: "", topic: "B" },
      { week: 1, weekSuffix: "", topic: "C" },
      { week: 1, weekSuffix: "", topic: "D" },
    ]);
    expect(out.map((t) => t.weekSuffix)).toEqual(["", "A", "B", "C"]);
  });

  it("disambiguates per week independently", () => {
    const out = assignWeekSuffixes([
      { week: 1, weekSuffix: "", topic: "A" },
      { week: 1, weekSuffix: "", topic: "B" },
      { week: 2, weekSuffix: "", topic: "C" },
    ]);
    expect(out.map((t) => `${t.week}:${t.weekSuffix}`)).toEqual(["1:", "1:A", "2:"]);
  });

  it("normalizes non-string suffix values", () => {
    const out = assignWeekSuffixes([{ week: 1, weekSuffix: 1 as unknown as string, topic: "A" }]);
    expect(out[0].weekSuffix).toBe("1");
  });
});
