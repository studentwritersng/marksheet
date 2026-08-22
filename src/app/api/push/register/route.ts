import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";

/**
 * Registers an FCM device token for the authenticated user.
 * Identity comes ONLY from the session cookie — the body carries the token
 * alone, so one user can never register a device against another account.
 * Upsert-by-token means logging a second user into the same phone
 * transparently moves the device to the new account.
 */

const MIN_TOKEN_LEN = 8;
const MAX_TOKEN_LEN = 4096;

export async function POST(req: Request) {
  if (!checkRateLimit(`pushreg:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fcmToken?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fcmToken = typeof body.fcmToken === "string" ? body.fcmToken.trim() : "";
  const platform = typeof body.platform === "string" && body.platform ? body.platform.slice(0, 32) : "android";
  if (fcmToken.length < MIN_TOKEN_LEN || fcmToken.length > MAX_TOKEN_LEN) {
    return NextResponse.json({ error: "Invalid fcmToken" }, { status: 400 });
  }

  await prisma.pushDevice.upsert({
    where: { fcmToken },
    update: { userId: user.userId, schoolId: user.schoolId, platform },
    create: { fcmToken, userId: user.userId, schoolId: user.schoolId, platform },
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
