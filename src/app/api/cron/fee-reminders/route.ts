import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRemindersForSchool } from "@/app/(app)/fees/reminders/actions";

// Cron endpoints must always run dynamically (never statically cached).
export const dynamic = "force-dynamic";

/**
 * Authorize the cron request.
 * - If CRON_SECRET is configured it must be supplied via
 *   `Authorization: Bearer <secret>` or the `?secret=` query param.
 * - If no CRON_SECRET is set we allow the call outside production so the
 *   route can be exercised locally, but we enforce it in production.
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const querySecret = new URL(req.url).searchParams.get("secret");
    return auth === `Bearer ${secret}` || querySecret === secret;
  }
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().getDay(); // 0..6 (Sun..Sat)

  // Weekly-enabled configs that haven't been sent in the last 6 days.
  const configs = await prisma.feeReminderConfig.findMany({
    where: {
      weeklyEnabled: true,
      OR: [
        { lastSentAt: null },
        { lastSentAt: { lt: new Date(Date.now() - 6 * 864e5) } },
      ],
    },
  });

  const schools: string[] = [];
  let processed = 0;

  for (const cfg of configs) {
    // Only fire on the configured day of week.
    if (cfg.dayOfWeek !== today) continue;

    // Mirror the /fees pages: active term = current term of current session,
    // falling back to the first term of the session.
    const session = await prisma.session.findFirst({
      where: { schoolId: cfg.schoolId, isCurrent: true },
      include: { terms: { orderBy: { name: "asc" } } },
    });
    const activeTerm =
      session?.terms.find((t) => t.isCurrent) ?? session?.terms[0];
    if (!activeTerm) continue;

    await sendRemindersForSchool(cfg.schoolId, activeTerm.id);

    // Best-effort: record the last send time so we don't double-send.
    await prisma.feeReminderConfig
      .update({
        where: { id: cfg.id },
        data: { lastSentAt: new Date() },
      })
      .catch(() => {});

    schools.push(cfg.schoolId);
    processed++;
  }

  return NextResponse.json({ ok: true, processed, schools });
}
