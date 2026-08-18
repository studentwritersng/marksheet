import { describe, it, expect } from "vitest";
import { getLeaderboard } from "./leaderboard";

describe("getLeaderboard", () => {
  it("returns ranked students by points", async () => {
    const board = await getLeaderboard("school-1");
    expect(Array.isArray(board)).toBe(true);
    // Descending by points
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].points).toBeGreaterThanOrEqual(board[i].points);
    }
  });
});
