import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deleteStaleRateLimitBuckets, pruneStaleRateLimitBuckets } from "./prune-buckets";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiRateLimitBucket: {
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const deleteManyMock = prisma.aiRateLimitBucket.deleteMany as ReturnType<typeof vi.fn>;

describe("deleteStaleRateLimitBuckets", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    deleteManyMock.mockResolvedValue({ count: 0 });
  });

  it("prunes buckets whose window started more than 2 days ago", async () => {
    await deleteStaleRateLimitBuckets();
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    const cutoff = deleteManyMock.mock.calls[0][0].where.windowStart.lt as Date;
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(Date.now() - 2 * 24 * 60 * 60 * 1000 - 1000);
  });

  it("fails open when the database errors", async () => {
    deleteManyMock.mockRejectedValueOnce(new Error("db unreachable"));
    await expect(deleteStaleRateLimitBuckets()).resolves.toBeUndefined();
  });
});

describe("pruneStaleRateLimitBuckets", () => {
  beforeEach(() => {
    deleteManyMock.mockReset();
    deleteManyMock.mockResolvedValue({ count: 0 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T14:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs at most once per hour per process", async () => {
    await pruneStaleRateLimitBuckets();
    expect(deleteManyMock).toHaveBeenCalledTimes(1);

    await pruneStaleRateLimitBuckets();
    expect(deleteManyMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-08-12T15:01:00Z"));
    await pruneStaleRateLimitBuckets();
    expect(deleteManyMock).toHaveBeenCalledTimes(2);
  });
});