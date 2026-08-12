# AI Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce owner-configurable AI rate limits (per-user daily, per-user per-minute burst, per-school daily cap) inside the AI gateway before any provider round-trip, with a Postgres-backed limiter that can later swap for Redis.

**Architecture:** Add two Prisma models (`AiRateLimitSetting` single-row config, `AiRateLimitBucket` counters) + a `userId` column on `AiCallLog`. Introduce a `RateLimiter` interface (`checkAndIncrement(RateLimitWindow)`) implemented by `PostgresRateLimiter` using an atomic `upsert … count++`; a pure `buildWindows`/`dailyWindowStart`/`formatRateLimitMessage` layer keeps the logic DB-free and unit-testable. `createCompletion` calls `enforceRateLimits(opts, deps)` after the mock pass-through and before the provider loop. `userId` is threaded through all 5 call sites so calls without a school scope still get per-user limits. The Platform Owner Console gets a "Rate Limits" card.

**Tech Stack:** Next.js 16 server actions, Prisma (Postgres/Neon), React 19 client components, vitest, Tailwind design tokens. No new runtime dependencies (Redis comes later via the same interface).

## Global Constraints

- Follow the approved spec: `docs/superpowers/specs/2026-08-12-ai-rate-limiting-design.md`
- Defaults when no settings row exists: `enabled=true`, per-user daily `15`, per-user per-minute burst `5`, per-school daily cap `300`, reset `"00:00"` UTC.
- Combined totals across ALL `AiTaskType` values — never per-task. Mock mode (`AI_MOCK=true`) bypasses counting entirely.
- Fixed-window rollover at the configured `resetsAtUtc` (default `00:00` UTC = 1:00 WAT). Keys are `user:{userId}:day:YYYY-MM-DD`, `user:{userId}:min:{epochMinute}`, `school:{schoolId}:day:YYYY-MM-DD`.
- Fail-open: any counter/settings DB error lets the AI call proceed; only a definitive over-limit blocks.
- Blocked call: `AiGatewayError` with informative `you have used {used}/{limit} … reset … UTC` message, plus a `rate_limited` row in `AiCallLog`.
- Owner-console auth: `role === "platform_owner"` via the existing `guard()` in `src/app/console/(main)/ai/actions.ts`; every save goes through `recordAudit`.
- No comments in code unless they explain non-obvious domain logic (match existing style).
- Verify with `npx tsc --noEmit`, `npm run lint` (only changed lines need to be clean; the pre-existing `no-explicit-any` at `create-question-form.tsx:507` is unrelated), and `npx vitest run src/lib/ai` for the new tests plus `npm test` for the full regression net.

---

## File Structure

- Modify: `prisma/schema.prisma` — add `AiRateLimitSetting`, `AiRateLimitBucket`; add `userId String?` to `AiCallLog`.
- Create: `prisma/migrations/<timestamp>_add_ai_rate_limits/migration.sql` — generated, then applied.
- Create: `src/lib/ai/rate-limit.ts` — `RateLimiter` interface, `PostgresRateLimiter`, `buildWindows`, `dailyWindowStart`, `formatRateLimitMessage`, `checkRateLimits`, `DEFAULT_RATE_LIMIT_SETTINGS`, `RateLimitSettings`, window/decision types.
- Modify: `src/lib/ai/gateway.ts` — `AiCompletionOptions` gains `userId?: string`; `logAiCall` accepts + persists `userId`; new exported `enforceRateLimits`; wire it into `createCompletion`.
- Modify: `src/app/(app)/questions/actions.ts`, `src/app/(app)/lesson-notes/actions.ts`, `src/lib/exams/essay-grading.ts`, `src/app/console/(main)/curriculum/actions.ts` — pass `userId` at each `createCompletion` call.
- Modify: `src/app/console/(main)/ai/actions.ts` — add `saveAiRateLimitSettingsAction`.
- Modify: `src/app/console/(main)/ai/page.tsx` — fetch settings + current usage, pass to client.
- Modify: `src/app/console/(main)/ai/client.tsx` — render Rate Limits card.
- Test: `src/lib/ai/rate-limit.test.ts` — all new logic.

---

### Task 1: Prisma schema + migration for rate limiting

**Files:**
- Modify: `prisma/schema.prisma` (insert after the `AiCallLog` block, ~line 558; add `userId` inside `AiCallLog`)
- Create: `prisma/migrations/<timestamp>_add_ai_rate_limits/migration.sql` (folder name from `npx prisma migrate diff` run below)
- Test: deploy via `db:push:both` (no unit test — schema only)

**Interfaces:**
- Consumes: nothing.
- Produces: models `AiRateLimitSetting`, `AiRateLimitBucket` and column `ai_call_logs."userId"` queried by Tasks 3/5/6.

- [ ] **Step 1: Add the models to `prisma/schema.prisma`**

Insert this block immediately after the `AiCallLog` model (ends at `@@map("ai_call_logs")`, line 558):

```prisma
model AiRateLimitSetting {
  id                   String   @id @default(cuid())
  enabled              Boolean  @default(true)
  perUserDailyQuota    Int      @default(15)
  perUserPerMinuteBurst Int     @default(5)
  perSchoolDailyCap    Int      @default(300)
  resetsAtUtc          String   @default("00:00") // fixed daily rollover, "HH:MM" UTC
  createdBy            String?
  updatedAt            DateTime @updatedAt

  @@map("ai_rate_limit_settings")
}

model AiRateLimitBucket {
  id          String   @id @default(cuid())
  key         String   @unique // user:{id}:day:YYYY-MM-DD / user:{id}:min:{epochMinute} / school:{id}:day:YYYY-MM-DD
  windowStart DateTime
  count       Int      @default(0)
  updatedAt   DateTime @updatedAt

  @@index([windowStart])
  @@map("ai_rate_limit_buckets")
}
```

In `AiCallLog`, add the `userId` column after `schoolId` and update the status comment:

```prisma
  taskType         String
  schoolId         String?
  userId           String?
  providerConfigId String?
```

- [ ] **Step 2: Generate the migration SQL without a live DB**

Run: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260812000000_add_ai_rate_limits/migration.sql`

First create the folder: `mkdir prisma/migrations/20260812000000_add_ai_rate_limits` (the redirect creates the file, but only if the folder exists).

Verify the generated SQL contains three statements:
- `CREATE TABLE "ai_rate_limit_settings"` with `"perUserDailyQuota" INTEGER NOT NULL DEFAULT 15`, `"perUserPerMinuteBurst" INTEGER NOT NULL DEFAULT 5`, `"perSchoolDailyCap" INTEGER NOT NULL DEFAULT 300`, `"resetsAtUtc" TEXT NOT NULL DEFAULT '00:00'`.
- `CREATE TABLE "ai_rate_limit_buckets"` with `"key" TEXT NOT NULL`, a unique index on `"key"`, and an index on `"windowStart"`.
- `ALTER TABLE "ai_call_logs" ADD COLUMN "userId" TEXT`.

- [ ] **Step 3: Apply to local + online databases**

Run: `npm run db:push:both` then `npm run db:generate`

Expected: both pushes succeed, `prisma generate` completes, client types for `aiRateLimitSetting` / `aiRateLimitBucket` / `aiCallLog.userId` exist.

- [ ] **Step 4: Sanity-check the client types**

Run: `node -e "const p=require('@prisma/client'); console.log(Object.keys(p.PrismaModelName).filter(k=>/RateLimit/i.test(k)))"`

Expected: prints `AiRateLimitSetting, AiRateLimitBucket`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260812000000_add_ai_rate_limits/migration.sql
git commit -m "feat: add AI rate-limit schema models"
```

---

### Task 2: Pure rate-limit helpers + tests

**Files:**
- Create: `src/lib/ai/rate-limit.ts`
- Test: `src/lib/ai/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing external (pure TS; `PostgresRateLimiter` dynamic-imports `@/lib/prisma` internally).
- Produces: `RateLimitSettings`, `DEFAULT_RATE_LIMIT_SETTINGS`, `RateLimitKind`, `RateLimitWindow`, `RateLimitDecision`, `RateLimiter`, `dailyWindowStart(now, resetsAtUtc): Date`, `buildWindows(input): RateLimitWindow[]`, `formatRateLimitMessage(kind, used, limit, resetsAtUtc): string`, `checkRateLimits(input): Promise<{ windows; failures }>`, `PostgresRateLimiter`. Used by Tasks 3-6.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai/rate-limit.test.ts` (pure tests only; the limiter tests in Step 3 are separate):

```ts
import { describe, it, expect } from "vitest";
import {
  dailyWindowStart,
  buildWindows,
  formatRateLimitMessage,
  DEFAULT_RATE_LIMIT_SETTINGS,
} from "./rate-limit";

describe("dailyWindowStart", () => {
  it("returns today 00:00 UTC for a mid-day time at default reset", () => {
    const now = new Date("2026-08-12T14:30:00Z");
    const start = dailyWindowStart(now, "00:00");
    expect(start.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });

  it("rolls to the previous day when before the reset boundary", () => {
    const now = new Date("2026-08-12T10:00:00Z");
    const start = dailyWindowStart(now, "13:00");
    expect(start.toISOString()).toBe("2026-08-11T13:00:00.000Z");
  });

  it("uses the same boundary when now is exactly on it", () => {
    const now = new Date("2026-08-12T13:00:00Z");
    const start = dailyWindowStart(now, "13:00");
    expect(start.toISOString()).toBe("2026-08-12T13:00:00.000Z");
  });
});

describe("buildWindows", () => {
  it("produces user_daily + user_minute windows for a user without a school", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: null,
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(2);
    expect(windows.map((w) => w.kind).sort()).toEqual(["user_daily", "user_minute"]);
    expect(windows.find((w) => w.kind === "user_daily")?.key).toBe("user:u1:day:2026-08-12");
    expect(windows.find((w) => w.kind === "user_daily")?.limit).toBe(15);
    expect(windows.find((w) => w.kind === "user_minute")?.limit).toBe(5);
  });

  it("adds a school_daily window when schoolId is present", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(3);
    expect(windows.find((w) => w.kind === "school_daily")?.key).toBe("school:s1:day:2026-08-12");
    expect(windows.find((w) => w.kind === "school_daily")?.limit).toBe(300);
  });

  it("returns an empty list when limits are disabled", () => {
    const windows = buildWindows({
      userId: "u1",
      schoolId: "s1",
      settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, enabled: false },
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(0);
  });

  it("ignores a reset boundary in the date rollover by isolating the minute window minute key", () => {
    const now = new Date("2026-08-12T14:00:00Z");
    const a = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    const next = new Date(now.getTime() + 60_000);
    const b = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now: next });
    const minuteA = a.find((w) => w.kind === "user_minute")!;
    const minuteB = b.find((w) => w.kind === "user_minute")!;
    expect(minuteA.key).not.toBe(minuteB.key);
  });

  it("checks only the school cap when only a schoolId is present", () => {
    const windows = buildWindows({
      userId: null,
      schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows).toHaveLength(1);
    expect(windows[0].kind).toBe("school_daily");
    expect(windows[0].key).toBe("school:s1:day:2026-08-12");
  });
});

describe("formatRateLimitMessage", () => {
  it("includes used/limit and the reset time for a user daily block", () => {
    const msg = formatRateLimitMessage("user_daily", 16, 15, "00:00");
    expect(msg).toContain("you have used 16/15");
    expect(msg).toContain("00:00 UTC");
  });

  it("has a friendly minute-burst message", () => {
    const msg = formatRateLimitMessage("user_minute", 6, 5, "00:00");
    expect(msg).toContain("Too many AI requests in a short time");
  });

  it("mentions the school for a school_daily block", () => {
    const msg = formatRateLimitMessage("school_daily", 301, 300, "00:00");
    expect(msg).toContain("for your school");
    expect(msg).toContain("301/300");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: FAIL — `./rate-limit` module not found / exports missing.

- [ ] **Step 3: Implement the pure helpers in `src/lib/ai/rate-limit.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: PASS (all pure tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/rate-limit.ts src/lib/ai/rate-limit.test.ts
git commit -m "feat: add pure AI rate-limit window helpers"
```

---

### Task 3: `PostgresRateLimiter` + block-on-failure behaviour

**Files:**
- Modify: `src/lib/ai/rate-limit.ts` (add `PostgresRateLimiter` class)
- Test: `src/lib/ai/rate-limit.test.ts` (append limiter tests)

**Interfaces:**
- Consumes: `RateLimitWindow`, `RateLimitDecision`, `RateLimiter`, `checkRateLimits` from Task 2.
- Produces: `class PostgresRateLimiter implements RateLimiter` with `checkAndIncrement(w)` using `prisma.aiRateLimitBucket.upsert({ where: { key }, update: { count: { increment: 1 } }, create: { key, windowStart, count: 1 } })`, returning `allowed = used <= w.limit`, `resetAt = w.windowEnd`, plus a best-effort lazy prune of buckets older than 2 days. Used by Task 4.

- [ ] **Step 1: Append failing tests for the limiter**

At the end of `src/lib/ai/rate-limit.test.ts`, add:

```ts
import { vi, beforeEach } from "vitest";
import { PostgresRateLimiter, checkRateLimits } from "./rate-limit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiRateLimitBucket: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const upsertMock = prisma.aiRateLimitBucket.upsert as ReturnType<typeof vi.fn>;
const deleteManyMock = prisma.aiRateLimitBucket.deleteMany as ReturnType<typeof vi.fn>;

describe("PostgresRateLimiter", () => {
  beforeEach(() => {
    deleteManyMock.mockResolvedValue({ count: 0 });
  });

  it("allows a call at exactly the limit and blocks the first over-limit call", async () => {
    const limiter = new PostgresRateLimiter();
    const start = new Date("2026-08-12T14:00:00Z");
    const windows = buildWindows({
      userId: "u1", schoolId: null,
      settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, perUserDailyQuota: 1, perUserPerMinuteBurst: 1 },
      now: start,
    });

    // first call → used == 1 == limit → allowed
    upsertMock.mockResolvedValueOnce({ count: 1 });
    const d1 = await limiter.checkAndIncrement(windows[1]); // user_daily
    expect(d1.allowed).toBe(true);
    expect(d1.used).toBe(1);

    // second call → used == 2 > limit → blocked
    upsertMock.mockResolvedValueOnce({ count: 2 });
    const d2 = await limiter.checkAndIncrement(windows[1]);
    expect(d2.allowed).toBe(false);
    expect(d2.used).toBe(2);
  });

  it("persists windowStart from the window and resets via the new key on rollover", async () => {
    const limiter = new PostgresRateLimiter();
    const now = new Date("2026-08-12T14:03:35Z");
    const windows = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    const w = windows.find((x) => x.kind === "user_minute")!;
    expect(w.windowStart.toISOString()).toBe("2026-08-12T14:03:00.000Z");
    expect(w.key).toBe(`user:u1:min:${Math.floor(now.getTime() / 60_000)}`);
    await limiter.checkAndIncrement(w);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: w.key },
      update: { count: { increment: 1 } },
    }));
    expect(upsertMock.mock.calls[0][0].create.count).toBe(1);
  });

  it("prunes buckets older than 2 days after each increment", async () => {
    const limiter = new PostgresRateLimiter();
    const now = new Date("2026-08-12T14:00:00Z");
    const [w] = buildWindows({ userId: "u1", schoolId: null, settings: DEFAULT_RATE_LIMIT_SETTINGS, now });
    await limiter.checkAndIncrement(w);
    expect(deleteManyMock).toHaveBeenCalled();
    const cutoff = deleteManyMock.mock.calls[0][0].where.windowStart.lt;
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 2 * 24 * 60 * 60 * 1000);
  });
});

describe("checkRateLimits", () => {
  it("collects all failing windows in check order", async () => {
    const windows = buildWindows({
      userId: "u1", schoolId: "s1", settings: DEFAULT_RATE_LIMIT_SETTINGS, now: new Date("2026-08-12T14:00:00Z"),
    });
    expect(windows.map((w) => w.kind)).toEqual(["user_minute", "user_daily", "school_daily"]);
  });

  it("runs the injected limiter over every window and reports failures", async () => {
    const limiter = {
      async checkAndIncrement(w: { kind: string }) {
        const limit = w.kind === "user_minute" ? 5 : w.kind === "user_daily" ? 15 : 300;
        return { allowed: false, used: limit + 1, limit, resetAt: new Date() };
      },
    };
    const result = await checkRateLimits({
      userId: "u1", schoolId: "s1",
      settings: DEFAULT_RATE_LIMIT_SETTINGS,
      now: new Date("2026-08-12T14:00:00Z"),
      limiter,
    });
    expect(result.failures.map((f) => f.window.kind)).toEqual(["user_minute", "user_daily", "school_daily"]);
    expect(result.failures[1].decision.limit).toBe(15);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: FAIL — `PostgresRateLimiter` / `checkRateLimits` undefined or type errors.

- [ ] **Step 3: Implement `PostgresRateLimiter`**

Append to `src/lib/ai/rate-limit.ts`:

```ts
export class PostgresRateLimiter implements RateLimiter {
  async checkAndIncrement(w: RateLimitWindow): Promise<RateLimitDecision> {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.aiRateLimitBucket.upsert({
      where: { key: w.key },
      update: { count: { increment: 1 }, updatedAt: new Date() },
      create: { key: w.key, windowStart: w.windowStart, count: 1 },
      select: { count: true },
    });
    // Lazy prune so the bucket table stays bounded to ~2 days of traffic.
    try {
      const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
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
  }
}
```

- [ ] **Step 4: Run all rate-limit tests**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/rate-limit.ts src/lib/ai/rate-limit.test.ts
git commit -m "feat: postgres rate limiter with fixed-window upsert"
```

---

### Task 4: Enforce limits inside `createCompletion`

**Files:**
- Modify: `src/lib/ai/gateway.ts` — `AiCompletionOptions` (line 29), `logAiCall` (line 1336), `createCompletion` (line 1394), plus new exported `enforceRateLimits`.
- Test: `src/lib/ai/rate-limit.test.ts` (append enforcement tests) — covers the gateway seam without a DB.

**Interfaces:**
- Consumes: `RateLimiter`, `RateLimitSettings`, `DEFAULT_RATE_LIMIT_SETTINGS`, `buildWindows`, `checkRateLimits`, `formatRateLimitMessage` from rate-limit.ts.
- Produces: `interface AiCompletionOptions` now includes `userId?: string`; `export async function enforceRateLimits(opts, deps)` — the block gate `createCompletion` calls before the provider loop. Consumed by Task 5 (call sites pass `userId`).

- [ ] **Step 1: Write failing enforcement tests**

Append to `src/lib/ai/rate-limit.test.ts`:

```ts
import { enforceRateLimits, AiGatewayError } from "./gateway";

describe("enforceRateLimits (gateway seam)", () => {
  it("throws AiGatewayError with the used/limit message on an over-limit window", async () => {
    const limiter = {
      async checkAndIncrement(w: { key: string }) {
        const blocked = w.key.startsWith("user:") && w.key.includes(":day:");
        return blocked
          ? { allowed: false, used: 16, limit: 15, resetAt: new Date("2026-08-13T00:00:00Z") }
          : { allowed: true, used: 1, limit: 5, resetAt: new Date("2026-08-12T14:01:00Z") };
      },
    };
    const log = vi.fn<() => Promise<void>>();
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: "u1", schoolId: "s1" },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: DEFAULT_RATE_LIMIT_SETTINGS,
        limiter,
        log,
      },
    )).rejects.toThrow(AiGatewayError);
    expect(log).toHaveBeenCalled();
    const [msg] = (log as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("you have used 16/15");
  });

  it("does nothing when rate limiting is disabled", async () => {
    const limiter = { async checkAndIncrement() { throw new Error("must not be called"); } };
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: "u1", schoolId: "s1" },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: { ...DEFAULT_RATE_LIMIT_SETTINGS, enabled: false },
        limiter,
      },
    )).resolves.toBeUndefined();
  });

  it("does nothing when there are no windows (anonymous call)", async () => {
    const limiter = { async checkAndIncrement() { throw new Error("must not be called"); } };
    await expect(enforceRateLimits(
      { taskType: "question_generation", userId: null, schoolId: null },
      {
        now: new Date("2026-08-12T14:00:00Z"),
        settings: DEFAULT_RATE_LIMIT_SETTINGS,
        limiter,
      },
    )).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: FAIL — `enforceRateLimits` / `AiGatewayError` not exported from `./gateway`.

- [ ] **Step 3: Add `userId` to `AiCompletionOptions` and `logAiCall`**

In `gateway.ts` line 29 block, after `schoolId?: string;`:

```ts
  schoolId?: string; // for cost/usage attribution in AI Call Log
  userId?: string;   // for per-user rate limiting
```

In `logAiCall` (line 1336) signature, add `userId?: string | null;` to the params and pass it through:

```ts
async function logAiCall(opts: {
  taskType: string;
  schoolId?: string | null;
  userId?: string | null;
  providerConfigId?: string | null;
  modelName: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  status: string;
  errorDetail?: string | null;
  latencyMs?: number | null;
}): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.aiCallLog.create({ data: {
      taskType: opts.taskType,
      schoolId: opts.schoolId ?? null,
      userId: opts.userId ?? null,
      providerConfigId: opts.providerConfigId ?? null,
      ...
```

- [ ] **Step 4: Implement `enforceRateLimits` and wire into `createCompletion`**

Add this export above `createCompletion` (line 1394):

```ts
/**
 * Owner-configured AI rate limiting. Enforced before any provider round-trip.
 * Fails open on any counter/settings error — rate limiting must never block
 * AI generation. `deps` are injectable for tests; production uses the DB.
 */
export async function enforceRateLimits(
  opts: { taskType: AiTaskType; userId?: string | null; schoolId?: string | null },
  deps: {
    now?: Date;
    settings?: RateLimitSettings;
    limiter?: RateLimiter;
    log?: (detail: string) => Promise<void>;
  } = {},
): Promise<void> {
  try {
    let settings = deps.settings;
    if (!settings) {
      const { prisma } = await import("@/lib/prisma");
      const row = await prisma.aiRateLimitSetting.findFirst();
      settings = row
        ? {
            enabled: row.enabled,
            perUserDailyQuota: row.perUserDailyQuota,
            perUserPerMinuteBurst: row.perUserPerMinuteBurst,
            perSchoolDailyCap: row.perSchoolDailyCap,
            resetsAtUtc: row.resetsAtUtc,
          }
        : DEFAULT_RATE_LIMIT_SETTINGS;
      if (!settings.enabled) return;
    } else if (!settings.enabled) {
      return;
    }

    const limiter = deps.limiter ?? new PostgresRateLimiter();
    const { failures } = await checkRateLimits({
      userId: opts.userId,
      schoolId: opts.schoolId,
      settings,
      now: deps.now ?? new Date(),
      limiter,
    });
    if (failures.length === 0) return;

    const { window: failedWindow, decision } = failures[0];
    const msg = formatRateLimitMessage(failedWindow.kind, decision.used, decision.limit, settings.resetsAtUtc);

    const log = deps.log ?? (async (detail: string) => {
      await logAiCall({
        taskType: opts.taskType,
        schoolId: opts.schoolId,
        userId: opts.userId,
        providerConfigId: null,
        modelName: "rate_limited",
        status: "rate_limited",
        errorDetail: detail,
      });
    });
    await log(msg);
    throw new AiGatewayError(msg);
  } catch (e) {
    if (e instanceof AiGatewayError) throw e;
    // Any DB/counter failure fails open: let the call continue.
  }
}
```

In `createCompletion`, right after the `if (envCfg.mock)` block closes (line 1410) and before `const stack = await loadProviderStack();` (line 1412), insert:

```ts
  // Owner-configured rate limits: block before spending a provider call.
  await enforceRateLimits({
    taskType: opts.taskType,
    userId: opts.userId,
    schoolId: opts.schoolId,
  });
```

Because the mock branch returns earlier (line 1399-1410), `AI_MOCK=true` bypasses counting structurally — no counter is touched in mock mode.

Add the new imports at the top of `gateway.ts` (it currently has no imports, so add a block):

```ts
import { DEFAULT_RATE_LIMIT_SETTINGS, checkRateLimits, formatRateLimitMessage, PostgresRateLimiter, type RateLimiter, type RateLimitSettings } from "./rate-limit";
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/ai/rate-limit.test.ts`
Expected: PASS (pure + limiter + enforcement tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/gateway.ts src/lib/ai/rate-limit.test.ts
git commit -m "feat: enforce AI rate limits in createCompletion"
```

---

### Task 5: Thread `userId` through the 5 call sites

**Files:**
- Modify: `src/app/(app)/questions/actions.ts` (lines 259 and 660)
- Modify: `src/app/(app)/lesson-notes/actions.ts` (line 219)
- Modify: `src/lib/exams/essay-grading.ts` (line 84)
- Modify: `src/app/console/(main)/curriculum/actions.ts` (line 81)

**Interfaces:**
- Consumes: `createCompletion` options now include `userId` (Task 4).
- Produces: all AI calls are rate-limited per-user; curricular owner calls (no school) still get user limits. No new exports.

- [ ] **Step 1: `questions/actions.ts` — single-action call (line 259)**

The `ctx` there comes from `requireSchoolAdmin()` in `aiGenerateQuestionsAction`, so add the field:

```ts
  const result = await createCompletion({
    taskType: "question_generation",
    schoolId: ctx.schoolId,
    userId: ctx.user.userId,
    messages: [
```

- [ ] **Step 2: `questions/actions.ts` — chunked multi-action call (line 660)**

Inside `generateChunk` (which closes over `ctx`), add the same field:

```ts
    const result = await createCompletion({
      taskType: "question_generation",
      schoolId: ctx.schoolId,
      userId: ctx.user.userId,
      messages: [
```

- [ ] **Step 3: `lesson-notes/actions.ts` — line 219**

That action also has `ctx` from `requireSchoolAdmin()`:

```ts
    result = await createCompletion({
      taskType: "lesson_note_generation",
    schoolId: ctx.schoolId,
    userId: ctx.user.userId,
    messages: [
```

- [ ] **Step 4: `essay-grading.ts` — line 84**

`gradeEssayAnswersAction` uses `ctx` from `requireSchoolAdmin()`; add inside the `gradeAnswer` function which closes over `ctx`:

```ts
      const result = await createCompletion({
        taskType: "essay_grading",
        schoolId: ctx.schoolId,
        userId: ctx.user.userId,
        messages: [
```

- [ ] **Step 5: `curriculum/actions.ts` — line 81**

`parseCurriculumAction` uses `guardOwner()` which returns the user; add `user.userId`:

```ts
    const result = await createCompletion({
      taskType: "curriculum_parsing",
      userId: user.userId,
      messages: [
```

- [ ] **Step 6: Verify every call site passes `userId`**

Run: `npx tsc --noEmit`
Expected: exit 0. Then `npm test` runs the whole suite — all existing tests must stay green (regression net).

- [ ] **Step 7: Commit**

```bash
git add src/app/"(app)"/questions/actions.ts src/app/"(app)"/lesson-notes/actions.ts src/lib/exams/essay-grading.ts src/app/console/"(main)"/curriculum/actions.ts
git commit -m "feat: pass authenticated userId to AI rate limiter at all call sites"
```

---

### Task 6: Owner Console "Rate Limits" card

**Files:**
- Modify: `src/app/console/(main)/ai/actions.ts` — new `saveAiRateLimitSettingsAction`.
- Modify: `src/app/console/(main)/ai/page.tsx` — fetch settings + usage, pass to client.
- Modify: `src/app/console/(main)/ai/client.tsx` — render the Rate Limits card (props + UI).

**Interfaces:**
- Consumes: `DEFAULT_RATE_LIMIT_SETTINGS`, `dailyWindowStart` from `./rate-limit.ts` (page.tsx computes usage), `guard()` + `recordAudit` (existing console patterns).
- Produces: `export async function saveAiRateLimitSettingsAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult>`; page props `rateLimitSettings` and `usage` (objects described in Step 3).

- [ ] **Step 1: Write the server action**

In `src/app/console/(main)/ai/actions.ts`, after `setAiProviderPriorityAction`, add:

```ts
function clampLimit(raw: FormDataEntryValue | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

function normalizeResetsAtUtc(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "00:00";
}

export async function saveAiRateLimitSettingsAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const enabled = formData.get("enabled") === "on";
  const perUserDailyQuota = clampLimit(formData.get("perUserDailyQuota"), 15, 100000);
  const perUserPerMinuteBurst = clampLimit(formData.get("perUserPerMinuteBurst"), 5, 100000);
  const perSchoolDailyCap = clampLimit(formData.get("perSchoolDailyCap"), 300, 1000000);
  const resetsAtUtc = normalizeResetsAtUtc(formData.get("resetsAtUtc"));

  const data = { enabled, perUserDailyQuota, perUserPerMinuteBurst, perSchoolDailyCap, resetsAtUtc };
  const existing = await prisma.aiRateLimitSetting.findFirst();
  if (existing) {
    await prisma.aiRateLimitSetting.update({ where: { id: existing.id }, data });
  } else {
    await prisma.aiRateLimitSetting.create({ data: { ...data, createdBy: user.userId } });
  }

  await recordAudit({
    actorId: user.userId,
    action: "update",
    entityType: "ai_rate_limit_setting",
    afterValue: data as never,
  });

  revalidatePath("/console/ai");
  return { success: "Rate limits saved." };
}
```

- [ ] **Step 2: Fetch settings + usage in `page.tsx`**

Replace the `return` in `ConsoleAiConfigPage` with props from the DB:

```ts
  const settingsRow = await prisma.aiRateLimitSetting.findFirst();
  const rateLimitSettings = settingsRow
    ? {
        enabled: settingsRow.enabled,
        perUserDailyQuota: settingsRow.perUserDailyQuota,
        perUserPerMinuteBurst: settingsRow.perUserPerMinuteBurst,
        perSchoolDailyCap: settingsRow.perSchoolDailyCap,
        resetsAtUtc: settingsRow.resetsAtUtc,
      }
    : {
        enabled: true,
        perUserDailyQuota: 15,
        perUserPerMinuteBurst: 5,
        perSchoolDailyCap: 300,
        resetsAtUtc: "00:00",
      };

  const todayStart = dailyWindowStart(new Date(), rateLimitSettings.resetsAtUtc);
  const buckets = await prisma.aiRateLimitBucket.findMany({
    where: { windowStart: { gte: todayStart } },
    select: { key: true, count: true },
  });
  const groups = buckets.reduce((acc, b) => {
    const n = acc.get(b.key) ?? 0;
    acc.set(b.key, n + b.count);
    return acc;
  }, new Map<string, number>());
  const usage = {
    userDaily: [...groups.entries()].filter(([k]) => k.startsWith("user:") && k.includes(":day:")).reduce((s, [, c]) => s + c, 0),
    userMinute: [...groups.entries()].filter(([k]) => k.startsWith("user:") && k.includes(":min:")).reduce((s, [, c]) => s + c, 0),
    schoolDaily: [...groups.entries()].filter(([k]) => k.startsWith("school:")).reduce((s, [, c]) => s + c, 0),
  };

  return (
    <AiConfigClient
      providers={providers.map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.baseUrl,
        hasKey: !!p.apiKeyEncrypted,
        defaultModelName: p.defaultModelName,
        priority: p.priority,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      }))}
      rateLimitSettings={rateLimitSettings}
      usage={usage}
    />
  );
```

Add the import `dailyWindowStart` to `page.tsx` from `@/lib/ai/rate-limit`. The `rateLimitSettings` default fallback above uses literals matching `DEFAULT_RATE_LIMIT_SETTINGS` — do not import the constant (the fallback fields are identical, and the code above keeps one source of truth visible in the page).

- [ ] **Step 3: Render the card in `client.tsx`**

Update the `AiConfigClient` signature and add the card between the Task Profiles section and the Call Log link. Add props to the interface and a `useActionState` hook:

```ts
import { saveAiRateLimitSettingsAction } from "./actions";

interface RateLimitSettingsVM {
  enabled: boolean;
  perUserDailyQuota: number;
  perUserPerMinuteBurst: number;
  perSchoolDailyCap: number;
  resetsAtUtc: string;
}

interface UsageVM {
  userDaily: number;
  userMinute: number;
  schoolDaily: number;
}

export function AiConfigClient({
  providers: initial,
  rateLimitSettings: initialRateLimits,
  usage,
}: {
  providers: ProviderVM[];
  rateLimitSettings: RateLimitSettingsVM;
  usage: UsageVM;
}) {
  const [rateLimits, setRateLimits] = useState<RateLimitSettingsVM>(initialRateLimits);
  const [rateLimitState, rateLimitAction, rateLimitPending] = useActionState(saveAiRateLimitSettingsAction, {});
```

Then render (place this block right after the Task Profiles loop, before the `View AI Call Log →` link):

```tsx
      {/* Rate Limits card */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-semibold text-base">Rate Limits</h2>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${rateLimits.enabled ? "bg-emerald-900/50 text-emerald-300" : "bg-white/10 text-white/40"}`}>
            {rateLimits.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Combined AI calls per user and per school. Rollover at {rateLimits.resetsAtUtc} UTC daily.
          Click save after editing limits.
        </p>

        <form action={rateLimitAction} className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
            <span>Today · User daily: <span className="text-white/80 font-mono">{usage.userDaily}</span></span>
            <span>User per-minute: <span className="text-white/80 font-mono">{usage.userMinute}</span></span>
            <span>School daily: <span className="text-white/80 font-mono">{usage.schoolDaily}</span></span>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
            <input type="checkbox" name="enabled" checked={rateLimits.enabled}
              onChange={(e) => setRateLimits((p) => ({ ...p, enabled: e.target.checked }))}
              className="accent-emerald-500" />
            Enable rate limiting
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="User daily quota" name="perUserDailyQuota"
              value={rateLimits.perUserDailyQuota}
              onChange={(v) => setRateLimits((p) => ({ ...p, perUserDailyQuota: v }))} />
            <NumberField label="User per-minute burst" name="perUserPerMinuteBurst"
              value={rateLimits.perUserPerMinuteBurst}
              onChange={(v) => setRateLimits((p) => ({ ...p, perUserPerMinuteBurst: v }))} />
            <NumberField label="School daily cap" name="perSchoolDailyCap"
              value={rateLimits.perSchoolDailyCap}
              onChange={(v) => setRateLimits((p) => ({ ...p, perSchoolDailyCap: v }))} />
          </div>

          <label className="block text-xs text-white/70">
            Daily reset (UTC, HH:MM)
            <input type="text" name="resetsAtUtc" value={rateLimits.resetsAtUtc}
              onChange={(e) => setRateLimits((p) => ({ ...p, resetsAtUtc: e.target.value }))}
              className="mt-1 w-full sm:w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-white/30" />
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={rateLimitPending}
              className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 disabled:opacity-50">
              {rateLimitPending ? "Saving…" : "Save rate limits"}
            </button>
            {rateLimitState.error && <span className="text-xs text-red-400">{rateLimitState.error}</span>}
            {rateLimitState.success && <span className="text-xs text-emerald-400">{rateLimitState.success}</span>}
          </div>
        </form>
      </div>
```

Add the tiny `NumberField` helper component at the bottom of `client.tsx` (match existing style — these are controlled inputs that edit `rateLimits` state):

```tsx
function NumberField({ label, name, value, onChange }: {
  label: string; name: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-white/70">
      {label}
      <input
        type="number" min={1} name={name} value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-white/30"
      />
    </label>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Existing console page must keep compiling — the `providers` prop shape is unchanged.

- [ ] **Step 5: Lint changed files**

Run: `npx eslint src/app/console/"(main)"/ai/actions.ts src/app/console/"(main)"/ai/page.tsx src/app/console/"(main)"/ai/client.tsx`
Expected: no new errors (pre-existing issues out of scope).

- [ ] **Step 6: Commit**

```bash
git add src/app/console/"(main)"/ai/actions.ts src/app/console/"(main)"/ai/page.tsx src/app/console/"(main)"/ai/client.tsx
git commit -m "feat: owner console rate limits card"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: ALL tests pass (existing regression net + new rate-limit tests).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: `tsc` exits 0; lint shows no **new** errors on changed files.

- [ ] **Step 3: Smoke-test the console and a rate-limited flow**

Start dev server (or use the deployed app):
1. Log in as `platform_owner` → Console → AI Config → the "Rate Limits" card shows `Enabled`, defaults 15/5/300, reset `00:00; save persists.
2. As a school admin, generate questions from a lesson note twice; the AI Call Log shows `success` rows with the caller's `userId` populated.
3. Temporarily set per-user daily quota to `1` in the console, then trigger two AI calls from the same user — the second returns the block message `you have used 2/1 … daily reset is at 00:00 UTC`, and the Call Log has a `rate_limited` row.
4. Restore the quota to `15`.

- [ ] **Step 4: Confirm scope is complete**

Checked against the approved spec `docs/superpowers/specs/2026-08-12-ai-rate-limiting-design.md`: data model (T1), gateway enforcement (T2–T4), `userId` threading (T5), owner console (T6), fixed-UTC rollover + combined totals + defaults (T2/T4), informative message + rate_limited log (T4), lazy prune + fail-open (T3/T4), Redis seam via `RateLimiter` interface (T2), Vitest coverage (T2–T4).

- [ ] **Step 5: No commit needed** — worker may only commit if a verification step produced fixes.