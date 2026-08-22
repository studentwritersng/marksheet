import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";

/**
 * Removes an FCM token for the authenticated user (called on logout).
 * Scoped to the caller's userId: nobody can unregister someone else's device.
 */
export async function POST(req: Request) {
  if (!checkRateLimit(`pushunreg:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fcmToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fcmToken = typeof body.fcmToken === "string" ? body.fcmToken.trim() : "";
  if (!fcmToken) return NextResponse.json({ error: "Invalid fcmToken" }, { status: 400 });

  await prisma.pushDevice.deleteMany({ where: { fcmToken, userId: user.userId } });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
