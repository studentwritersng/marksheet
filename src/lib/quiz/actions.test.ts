import { describe, it, expect } from "vitest";
import { getQuizBankStats } from "./actions";

describe("getQuizBankStats", () => {
  it("returns the full coverage shape with topicCoveragePct in [0,100]", async () => {
    const stats = await getQuizBankStats();
    expect(stats).toHaveProperty("totalQuestions");
    expect(stats).toHaveProperty("standardTopicCount");
    expect(stats).toHaveProperty("coveredTopicCount");
    expect(stats).toHaveProperty("topicCoveragePct");
    expect(stats.topicCoveragePct).toBeGreaterThanOrEqual(0);
    expect(stats.topicCoveragePct).toBeLessThanOrEqual(100);
  });
});
