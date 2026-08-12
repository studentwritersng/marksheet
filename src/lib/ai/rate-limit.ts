export type RateLimitKind = "user_daily" | "user_minute" | "school_daily";

export interface RateLimitWindow {
  key: string;
  kind: RateLimitKind;
  limit: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface RateLimitDecision {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: Date;
}

export interface RateLimiter {
  checkAndIncrement(w: RateLimitWindow): Promise<RateLimitDecision>;
}

export interface RateLimitSettings {
  enabled: boolean;
  perUserDailyQuota: number;
  perUserPerMinuteBurst: number;
  perSchoolDailyCap: number;
  resetsAtUtc: string;
}

export const DEFAULT_RATE_LIMIT_SETTINGS: RateLimitSettings = {
  enabled: true,
  perUserDailyQuota: 15,
  perUserPerMinuteBurst: 5,
  perSchoolDailyCap: 300,
  resetsAtUtc: "00:00",
};

/** Most recent daily window boundary at or before `now`, in UTC, honouring resetsAtUtc ("HH:MM"). */
export function dailyWindowStart(now: Date, resetsAtUtc: string): Date {
  const [hour, minute] = (resetsAtUtc || "00:00").split(":").map(Number);
  const boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  if (boundary.getTime() > now.getTime()) boundary.setUTCDate(boundary.getUTCDate() - 1);
  return boundary;
}

export function buildWindows(input: {
  userId?: string | null;
  schoolId?: string | null;
  settings: RateLimitSettings;
  now: Date;
}): RateLimitWindow[] {
  const { userId, schoolId, settings, now } = input;
  if (!settings.enabled) return [];

  const windows: RateLimitWindow[] = [];
  const dayStart = dailyWindowStart(now, settings.resetsAtUtc);
  const dayKey = dayStart.toISOString().slice(0, 10);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  if (userId) {
    const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    windows.push({
      key: `user:${userId}:min:${Math.floor(now.getTime() / 60_000)}`,
      kind: "user_minute",
      limit: settings.perUserPerMinuteBurst,
      windowStart: minuteStart,
      windowEnd: new Date(minuteStart.getTime() + 60_000),
    });
    windows.push({
      key: `user:${userId}:day:${dayKey}`,
      kind: "user_daily",
      limit: settings.perUserDailyQuota,
      windowStart: dayStart,
      windowEnd: dayEnd,
    });
  }

  if (schoolId) {
    windows.push({
      key: `school:${schoolId}:day:${dayKey}`,
      kind: "school_daily",
      limit: settings.perSchoolDailyCap,
      windowStart: dayStart,
      windowEnd: dayEnd,
    });
  }

  return windows;
}

export function formatRateLimitMessage(
  kind: RateLimitKind,
  used: number,
  limit: number,
  resetsAtUtc: string,
): string {
  if (kind === "user_minute") {
    return "Too many AI requests in a short time. Please wait about a minute and try again.";
  }
  if (kind === "school_daily") {
    return `AI usage limit reached for your school: it has used ${used}/${limit} requests today. The daily reset is at ${resetsAtUtc} UTC. Please try again later.`;
  }
  return `AI usage limit reached: you have used ${used}/${limit} requests for today. The daily reset is at ${resetsAtUtc} UTC. Please try again later.`;
}

/** Runs every window through the limiter, collecting any that are already over their limit. */
export async function checkRateLimits(input: {
  userId?: string | null;
  schoolId?: string | null;
  settings: RateLimitSettings;
  now?: Date;
  limiter: RateLimiter;
}): Promise<{ windows: RateLimitWindow[]; failures: { window: RateLimitWindow; decision: RateLimitDecision }[] }> {
  const windows = buildWindows({
    userId: input.userId,
    schoolId: input.schoolId,
    settings: input.settings,
    now: input.now ?? new Date(),
  });
  const failures: { window: RateLimitWindow; decision: RateLimitDecision }[] = [];
  for (const w of windows) {
    const decision = await input.limiter.checkAndIncrement(w);
    if (!decision.allowed) failures.push({ window: w, decision });
  }
  return { windows, failures };
}
