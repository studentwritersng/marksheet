import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isPushConfigured } from "@/lib/notifications/push";

/**
 * Lightweight self-check for push delivery. Open while logged in:
 *   https://marksheet.top/api/push/diagnose
 * - pushConfigured: FCM_* env vars are present on the SERVER (false => silent no-op).
 * - myDevices: how many FCM tokens are registered for your account (0 => app
 *   never registered, i.e. permission/plugin/bridge issue on the device).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [myDevices, totalDevices] = await Promise.all([
    prisma.pushDevice.count({ where: { userId: user.userId } }),
    prisma.pushDevice.count(),
  ]);

  return NextResponse.json({
    pushConfigured: isPushConfigured(),
    fcmProjectId: process.env.FCM_PROJECT_ID ?? null,
    myDevices,
    totalDevices,
    userId: user.userId,
  });
}
