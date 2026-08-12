import { describe, it, expect, vi } from "vitest";
import {
  dailyWindowStart,
  buildWindows,
  formatRateLimitMessage,
  DEFAULT_RATE_LIMIT_SETTINGS,
} from "./rate-limit";

describe("dailyWindowStart", () => {
  it("returns today 00:00 UTC for a mid-day time at default reset", () => {
    const now = new Date("2026-08-12T14:30:00Z");
    const start = dailyWindowStart(now, "00:00");
    expect(start.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });

  it("rolls to the previous day when before the reset boundary", () => {
    const now = new Date("2026-08-12T10:00:00Z");
    const start = dailyWindowStart(now, "13:00");
    expect(start.toISOString()).toBe("2026-08-11T13:00:00.000Z");
  });

  it("uses the same boundary when now is exactly on it", () => {
    const now = new Date("2026-08-12T13:00:00Z");
    const start = dailyWindowStart(now, "13:00");
    expect(start.toISOString()).toBe("2026-08-12T13:00:00.000Z");
  });
});

describe("buildWindows", () => {
  it("produces user_daily + user_minute windows for a user without a school", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: null,
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(2);
    expect(windows.map((w) => w.kind).sort()).toEqual(["user_daily", "user_minute"]);
    expect(windows.find((w) => w.kind === "user_daily")?.key).toBe("user:u1:day:2026-08-12");
    expect(windows.find((w) => w.kind === "user_daily")?.limit).toBe(15);
    expect(windows.find((w) => w.kind === "user_minute")?.limit).toBe(5);
  });

  it("adds a school_daily window when schoolId is present", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(3);
    expect(windows.find((w) => w.kind === "school_daily")?.key).toBe("school:s1:day:2026-08-12");
    expect(windows.find((w) => w.kind === "school_daily")?.limit).toBe(300);
  });

  it("returns an empty list when limits are disabled", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: "s1",
      settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, enabled: false },
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(0);
  });

  it("ignores a reset boundary in the date rollover by isolating the minute window minute key", () => {
    const now = new Date("2026-08-12T14:00:00Z");
    const a = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    const next = new Date(now.getTime() + 60_000);
    const b = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now: next });
    const minuteA = a.find((w) => w.kind === "user_minute")!;
    const minuteB = b.find((w) => w.kind === "user_minute")!;
    expect(minuteA.key).not.toBe(minuteB.key);
  });

  it("checks only the school cap when only a schoolId is present", () => {
    const windows = buildWindows({
      userId: null,
      schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(1);
    expect(windows[0].kind).toBe("school_daily");
    expect(windows[0].key).toBe("school:s1:day:2026-08-12");
  });
});

describe("formatRateLimitMessage", () => {
  it("includes used/limit and the reset time for a user daily block", () => {
    const msg = formatRateLimitMessage("user_daily", 16, 15, "00:00");
    expect(msg).toContain("you have used 16/15");
    expect(msg).toContain("00:00 UTC");
  });

  it("has a friendly minute-burst message", () => {
    const msg = formatRateLimitMessage("user_minute", 6, 5, "00:00");
    expect(msg).toContain("Too many AI requests in a short time");
  });

  it("mentions the school for a school_daily block", () => {
    const msg = formatRateLimitMessage("school_daily", 301, 300, "00:00");
    expect(msg).toContain("for your school");
    expect(msg).toContain("301/300");
  });
});

import { enforceRateLimits, AiGatewayError } from "./gateway";

describe("enforceRateLimits (gateway seam)", () => {
  it("throws AiGatewayError with the used/limit message on an over-limit window", async () => {
    const limiter = {
      async checkAndIncrement(w: { key: string }) {
        const blocked = w.key.startsWith("user:") && w.key.includes(":day:");
        return blocked
          ? { allowed: false, used: 16, limit: 15, resetAt: new Date("2026-08-13T00:00:00Z") }
          : { allowed: true, used: 1, limit: 5, resetAt: new Date("2026-08-12T14:01:00Z") };
      },
    };
    const log = vi.fn<() => Promise<void>>();
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: "u1", schoolId: "s1" },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: DEFAULT_RATE_LIMIT_SETTINGS,
        limiter,
        log,
      },
    )).rejects.toThrow(AiGatewayError);
    expect(log).toHaveBeenCalled();
    const [msg] = (log as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("you have used 16/15");
  });

  it("does nothing when rate limiting is disabled", async () => {
    const limiter = { async checkAndIncrement() { throw new Error("must not be called"); } };
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: "u1", schoolId: "s1" },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, enabled: false },
        limiter,
      },
    )).resolves.toBeUndefined();
  });

  it("does nothing when there are no windows (anonymous call)", async () => {
    const limiter = { async checkAndIncrement() { throw new Error("must not be called"); } };
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: null, schoolId: null },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: DEFAULT_RATE_LIMIT_SETTINGS,
        limiter,
      },
    )).resolves.toBeUndefined();
  });
});
