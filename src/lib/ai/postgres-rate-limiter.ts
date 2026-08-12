import type { RateLimitDecision, RateLimiter, RateLimitWindow } from "./rate-limit";

/** Buckets older than this stay too long and are lazily pruned after an increment. */
const PRUNE_OLDER_THAN_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Postgres-backed fixed-window rate limiter backed by the ai_rate_limit_buckets
 * table. Each window key is a single row whose count is incremented atomically
 * via upsert, so concurrent calls cannot over-count. Buckets are lazily pruned
 * (best-effort) on every increment to keep the table bounded.
 */
export class PostgresRateLimiter implements RateLimiter {
  async checkAndIncrement(w: RateLimitWindow): Promise<RateLimitDecision> {
    try {
      const { prisma } = await import("@/lib/prisma");
      const row = await prisma.aiRateLimitBucket.upsert({
        where: { key: w.key },
        // updatedAt is a Prisma @updatedAt column and is set automatically.
        update: { count: { increment: 1 } },
        create: { key: w.key, windowStart: w.windowStart, count: 1 },
        select: { count: true },
      });
      // Lazy prune so the bucket table stays bounded to ~2 days of traffic.
      try {
        const cutoff = new Date(Date.now() - PRUNE_OLDER_THAN_MS);
        await prisma.aiRateLimitBucket.deleteMany({ where: { windowStart: { lt: cutoff } } });
      } catch {
        // prune is best-effort
      }
      return {
        allowed: row.count <= w.limit,
        used: row.count,
        limit: w.limit,
        resetAt: w.windowEnd,
      };
    } catch {
      // Fail open: never block a request because rate-limiting storage is unavailable.
      return {
        allowed: true,
        used: 0,
        limit: w.limit,
        resetAt: w.windowEnd,
      };
    }
  }
}