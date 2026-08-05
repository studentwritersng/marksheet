import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Lightweight unread-notification count for the current user.
 * Designed to be polled every ~30s: results are cached in-memory for a few
 * seconds so concurrent polls in the same window never touch the database.
 * Returns 401 when unauthenticated.
 */

const CACHE_TTL_MS = 5_000;
const unreadCache = new Map<string, { count: number; expiresAt: number }>();

function recipientScope(user: SessionPayload): { recipientType: string; recipientId: string } {
  if (user.role === "parent") return { recipientType: "parent", recipientId: user.userId };
  if (user.role === "student") return { recipientType: "student", recipientId: user.userId };
  return { recipientType: "staff", recipientId: user.staffId ?? user.userId };
}

export async function GET(req: Request) {
  if (!checkRateLimit(`unread:${clientKey(req)}`, 60, 60_000)) {
    return tooManyRequests();
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = recipientScope(user);
  const cacheKey = `${user.role}:${scope.recipientId}`;
  const now = Date.now();

  const cached = unreadCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ unread: cached.count }, { headers: { "Cache-Control": "no-store" } });
  }

  const count = await prisma.notification.count({
    where: { recipientType: scope.recipientType, recipientId: scope.recipientId, isRead: false },
  });

  unreadCache.set(cacheKey, { count, expiresAt: now + CACHE_TTL_MS });

  return NextResponse.json({ unread: count }, { headers: { "Cache-Control": "no-store" } });
}
