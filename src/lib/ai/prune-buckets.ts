/**
 * Cleanup for the ai_rate_limit_buckets table. The limiter prunes lazily after
 * each increment; pruneStaleRateLimitBuckets is the throttled global post-render
 * trigger so pruning still happens when no rate-limited traffic flows.
 */
export const PRUNE_OLDER_THAN_MS = 2 * 24 * 60 * 60 * 1000;

const PRUNE_MIN_INTERVAL_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

export async function deleteStaleRateLimitBuckets(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const cutoff = new Date(Date.now() - PRUNE_OLDER_THAN_MS);
    await prisma.aiRateLimitBucket.deleteMany({ where: { windowStart: { lt: cutoff } } });
  } catch {
    // prune is best-effort
  }
}

export async function pruneStaleRateLimitBuckets(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_MIN_INTERVAL_MS) return;
  lastPruneAt = now;
  await deleteStaleRateLimitBuckets();
}