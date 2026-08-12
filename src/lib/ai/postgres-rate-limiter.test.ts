import { vi, beforeEach, describe, it, expect } from "vitest";
import { checkRateLimits, buildWindows, DEFAULT_RATE_LIMIT_SETTINGS } from "./rate-limit";
import { PostgresRateLimiter } from "./postgres-rate-limiter";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiRateLimitBucket: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const upsertMock = prisma.aiRateLimitBucket.upsert as ReturnType<typeof vi.fn>;
const deleteManyMock = prisma.aiRateLimitBucket.deleteMany as ReturnType<typeof vi.fn>;

describe("PostgresRateLimiter", () => {
  beforeEach(() => {
    deleteManyMock.mockResolvedValue({ count: 0 });
  });

  it("allows a call at exactly the limit and blocks the first over-limit call", async () => {
    const limiter = new PostgresRateLimiter();
    const start = new Date("2026-08-12T14:00:00Z");
    const windows = buildWindows({
      userId: "u1", schoolId: null,
      settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, perUserDailyQuota: 1, perUserPerMinuteBurst: 1 },
      now: start,
    });

    // first call → used == 1 == limit → allowed
    upsertMock.mockResolvedValueOnce({ count: 1 });
    const d1 = await limiter.checkAndIncrement(windows[1]); // user_daily
    expect(d1.allowed).toBe(true);
    expect(d1.used).toBe(1);

    // second call → used == 2 > limit → blocked
    upsertMock.mockResolvedValueOnce({ count: 2 });
    const d2 = await limiter.checkAndIncrement(windows[1]);
    expect(d2.allowed).toBe(false);
    expect(d2.used).toBe(2);
  });

  it("persists windowStart from the window and resets via the new key on rollover", async () => {
    const limiter = new PostgresRateLimiter();
    const now = new Date("2026-08-12T14:03:35Z");
    const windows = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    const w = windows.find((x) => x.kind === "user_minute")!;
    expect(w.windowStart.toISOString()).toBe("2026-08-12T14:03:00.000Z");
    expect(w.key).toBe(`user:u1:min:${Math.floor(now.getTime() / 60_000)}`);
    await limiter.checkAndIncrement(w);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: w.key },
      update: { count: { increment: 1 } },
    }));
    expect(upsertMock.mock.calls[0][0].create.count).toBe(1);
  });

  it("prunes buckets older than 2 days after each increment", async () => {
    const limiter = new PostgresRateLimiter();
    const now = new Date("2026-08-12T14:00:00Z");
    const [w] = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    await limiter.checkAndIncrement(w);
    expect(deleteManyMock).toHaveBeenCalled();
    const cutoff = deleteManyMock.mock.calls[0][0].where.windowStart.lt;
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 2 * 24 * 60 * 60 * 1000);
  });

  it("fails open when the database errors instead of blocking the request", async () => {
    const limiter = new PostgresRateLimiter();
    const windows = buildWindows({
      userId: "u1", schoolId: null,
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    upsertMock.mockRejectedValueOnce(new Error("db unreachable"));
    const d = await limiter.checkAndIncrement(windows[0]);
    expect(d.allowed).toBe(true);
    expect(d.limit).toBe(windows[0].limit);
    expect(d.resetAt).toEqual(windows[0].windowEnd);
  });
});

describe("checkRateLimits", () => {
  it("collects all failing windows in check order", async () => {
    const windows = buildWindows({
      userId: "u1", schoolId: "s1", settings: DEFAULT_RATE_LIMIT_SETTINGS, now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows.map((w) => w.kind)).toEqual(["user_minute", "user_daily", "school_daily"]);
  });

  it("runs the injected limiter over every window and reports failures", async () => {
    const limiter = {
      async checkAndIncrement(w: { kind: string }) {
        const limit = w.kind === "user_minute" ? 5 : w.kind === "user_daily" ? 15 : 300;
        return { allowed: false, used: limit + 1, limit, resetAt: new Date() };
      },
    };
    const result = await checkRateLimits({
      userId: "u1", schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
      limiter,
    });
    expect(result.failures.map((f) => f.window.kind)).toEqual(["user_minute", "user_daily", "school_daily"]);
    expect(result.failures[1].decision.limit).toBe(15);
  });
});