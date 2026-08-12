# AI Rate Limiting — Design

Date: 2026-08-12
Status: Approved

## Problem

The AI gateway (`createCompletion`) is the single choke point for every AI call in the app (lesson-note generation, question generation, essay grading, comment drafting, curriculum parsing). Today there is no protection against one user (or one school, or a script) firing thousands of AI calls in a minute or blowing through the platform owner's API budget. The owner has no way to cap usage from their console.

## Goal

Add server-authoritative rate limiting on AI calls, configurable from the Platform Owner Console (`/console/ai`), enforcing three dimensions chosen by the owner:

1. **Per-user per-minute burst** — stop one account hammering, e.g. max 5 AI calls/user/min.
2. **Per-user daily quota** — control cost, e.g. max 15 AI calls/user/day.
3. **Per-school daily cap** — whole-school ceiling, e.g. max 300 AI calls/school/day.

Calls count agents. Limits are **combined across all task types** (not per-task). When a limit is hit the call is **hard-blocked** before the provider round-trip with an informative error message.

Defaults (owner can reconfigure later): per-user daily = **15**, per-user per-minute burst = **5**, per-school daily cap = **300**. Rollover at fixed **00:00 UTC** (1:00 WAT — Nigeria is single-timezone).

## Architecture Approach

**Selected: Postgres-backed counters (zero new infra).** A consumed unit is recorded in a Postgres bucket table with an atomic `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`. A clean `RateLimiter` interface makes later migration to Redis (Upstash/Vercel KV) a drop-in swap — the owner has confirmed they will move to Redis once live.

Alternatives rejected for now:
- **Upstash Redis now**: industry-standard for "thousands of hits/min" but adds a paid managed dependency + deployment setup; overkill at current school-scale volume.
- **Count from `AiCallLog`**: rejected — the gateway logs *after* calls (fire-and-forget) and today's log has no `userId`; counting must happen *before* the provider round-trip to block effectively.

## The Seam for Redis Later

All counters go through two methods so the storage engine is swappable:

```ts
export interface RateLimitWindow {
  key: string;        // e.g. "user:cma1b2:day:2026-08-12"
  limit: number;      // from config
  windowStart: Date;  // bucket window floor
}

export interface RateLimiter {
  /** Atomically count this attempt in the window; returns usage + allowed. */
  checkAndIncrement(w: RateLimitWindow): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    resetAt: Date;
  }>;
}
```

`PostgresRateLimiter` implements it with the bucket table + `ON CONFLICT` upsert. `RedisRateLimiter` (later) implements `INCR` + `EXPIRE` with the same signature; `gateway.ts` selects the implementation from an env flag / provider presence. Nothing else in the call path changes.

## Server: Prisma schema

### `AiRateLimitSetting` (single configured row)

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
```

### `AiRateLimitBucket` (counters)

```prisma
model AiRateLimitBucket {
  id           String   @id @default(cuid())
  key          String   @unique // "user:{id}:day:YYYY-MM-DD" / "user:{id}:min:{epochMinute}" / "school:{id}:day:YYYY-MM-DD"
  windowStart  DateTime          // bucket window floor, used for pruning
  count        Int      @default(0)
  updatedAt    DateTime @updatedAt
  @@index([windowStart])
  @@map("ai_rate_limit_buckets")
}
```

### `AiCallLog.userId` (audit/reporting)

Add `userId String?` to `AiCallLog` so the owner console can later report per-user usage and daily quotas can be derived from the ledger.

## Server: enforcement (`src/lib/ai/gateway.ts`)

Inside `createCompletion`, immediately after mock-bypass and config load, and **before** the provider round-trip:

1. Resolve active `AiRateLimitSetting` (single row). If `!enabled` → proceed with no counting.
2. Build keys for each dimension present in the request:
   - `user:{userId}:min:{floor(now/60s)}` → burst, limit `perUserPerMinuteBurst`
   - `user:{userId}:day:{YYYY-MM-DD}` → daily, limit `perUserDailyQuota`
   - `school:{schoolId}:day:{YYYY-MM-DD}` → daily, limit `perSchoolDailyCap`
   (skip dimensions with no id — e.g. a call with no `schoolId` only checks user limits.)
3. For each, call `limiter.checkAndIncrement(window)`. All must be allowed.
4. If any returns `allowed: false`:
   - `logAiCall({ taskType, schoolId, userId, status: "rate_limited", errorDetail: msg })`
   - throw `AiGatewayError(msg)` with an informative message, e.g.:
     `AI usage limit reached: you have used {used}/{limit} requests for today. The daily reset is at 00:00 UTC. Please try again later.`
     For the minute burst: `Too many AI requests in a short time. Please wait about a minute and try again.`
5. Mock mode (`AI_MOCK=true`) bypasses counting entirely (no cost — nothing to protect).

### Thread `userId` through call sites

`AiCompletionOptions` gains `userId?: string`. Update the 5 `createCompletion` call sites to pass the authenticated user id (all run inside authenticated server actions):

- `src/app/(app)/questions/actions.ts` — `aiGenerateQuestionsMultiAction`, `aiGenerateQuestionsAction`
- `src/app/(app)/lesson-notes/actions.ts`
- `src/lib/exams/essay-grading.ts`
- `src/app/console/(main)/curriculum/actions.ts`

## Owner console (`/console/ai`)

A **"Rate Limits"** card (owner-only, guarded like the existing provider/task-profile actions):

- Enable toggle (default on).
- Three knobs: user daily, user per-minute burst, school daily cap.
- Reset time field (HH:MM, fixed UTC; default `00:00`).
- Live usage readout: for the current window/day, show per-user and per-school usage vs caps (top users + schools from `AiRateLimitBucket`), so the owner sees headroom at a glance.
- Persisted via a new server action `saveAiRateLimitSettingsAction` guarded by `guard()` (role `platform_owner`), audited via `recordAudit`, then `revalidatePath("/console/ai")` — mirroring `upsertAiProviderAction`.

## Error handling

- Blocked calls: `AiGatewayError` → propagates to the calling action, which returns `{ error: msg }`; the existing client-side `try/catch` in `create-question-form.handleAiGenerate` surfaces it cleanly (fixed earlier in this session).
- Counter/DB failure while checking: **fail-open** (let the call proceed) — rate limiting must never brick AI generation; the check is wrapped in try/catch and only blocks on a definitive over-limit.
- Old buckets: `PostgresRateLimiter` prunes rows where `windowStart` is older than 2 days on each write (cheap `deleteMany` guard), keeping the table bounded.

## Testing (Vitest)

- **Fixed-window unit tests** (`src/lib/ai/rate-limit.test.ts`, or alongside) for a small in-memory `RateLimiter` or the real Postgres connection:
  - Allowed under limit; blocked at limit+1.
  - Minute vs day keys use different windows and both apply.
  - Rollover: a bucket whose `windowStart` is before the current window does not count (new window starts fresh).
  - Message contains `used/limit` and reset detail.
- **Gateway tests**: mock `RateLimiter`, verify N allowed then N+1 blocked; `schoolId`-only calls check only school cap; `mock` mode skips counting; report/throw happens before any provider fetch (assert provider not called on block).
- **Message-format test** for the exact user-facing strings.

## Out of scope

- Per-task-type limits (owner chose combined totals).
- Sliding-window algorithm (fixed windows chosen for simplicity; Redis swap can adopt sliding if desired).
- Quota refunds on provider 4xx (owner chose "every attempted call counts").