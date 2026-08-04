import { NextResponse } from "next/server";
import { processNotificationQueueAction } from "@/lib/notifications/provider-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, clientKey, tooManyRequests } from "@/lib/auth/route-security";

/**
 * Internal job endpoint. Only callable with the CRON_SECRET bearer token
 * (for scheduled runs) or by an authenticated platform_owner (for manual
 * "process queue" runs from the console).
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth === `Bearer ${secret}`) return true;
  }
  const user = await getCurrentUser();
  return user?.role === "platform_owner";
}

export async function GET(req: Request) {
  if (!checkRateLimit(`queue:${clientKey(req)}`, 10, 60_000)) {
    return tooManyRequests();
  }
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processNotificationQueueAction(50);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!checkRateLimit(`queue:${clientKey(req)}`, 10, 60_000)) {
    return tooManyRequests();
  }
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processNotificationQueueAction(50);
  return NextResponse.json(result);
}