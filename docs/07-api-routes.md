# 07 — API Route Handlers

## 1. Overview

Route handlers live under `src/app/api/**/route.ts`. They are used only where a plain HTTP endpoint is needed: public result verification, file upload, polling a lightweight JSON value, an internal queue job, and a few read-only lookups. All other mutations go through Server Actions.

All handlers use the security helpers from `src/lib/auth/route-security.ts` (see [03-authentication.md](./03-authentication.md)).

## 2. Route inventory

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `api/verify/route.ts` | GET | **Public** | Verify a finalised result by code. Returns student, class, school, session/term, overall average/position, per-subject scores/grades. |
| `api/verify/[shortcode]/route.ts` | GET | **Public** | School-scoped verify. Resolves school by shortcode; 403 if the code doesn't belong to that school. Also returns logo/motto. Must be a **finalised** result. |
| `api/upload/route.ts` | POST | Authenticated + same-origin | File upload. 5 MB cap, extension/MIME allowlist (png/jpg/webp/gif/svg/pdf), filename sanitisation, path-traversal guard, per-IP rate limit. Stores to Vercel Blob (prod) or `public/uploads` (local). |
| `api/timetable-generate/route.ts` | POST | Same-origin + school-admin + Timetable addon | Resolves current session/term + template, runs the timetable solver, persists `addonTimetable` + a `timetableGenerationRun`. |
| `api/question-groups/route.ts` | GET | School-admin | Lists `questionGroup.id`/`stimulusId` for a `subjectId` within the caller's school. |
| `api/messages/search/route.ts` | GET | Auth | Searches recipients for the compose box (delegates to `searchRecipientsAction`). |
| `api/notifications/unread/route.ts` | GET | Auth + rate-limited | Lightweight unread-notification count; polled ~every 30s by the bell; 5s in-memory cache. |
| `api/notifications/process-queue/route.ts` | GET/POST | `CRON_SECRET` bearer OR `platform_owner` | Internal job; processes 50 queued notifications per run. Rate-limited. |
| `api/exams/[examId]/essay-answers/route.ts` | GET | School-scoped | Validates the exam belongs to caller's school; returns pending/graded essay answers with AI suggestion, rubric, final scores. |
| `api/sentry-example-api/route.ts` | GET | — (demo) | Intentionally throws to exercise Sentry capture. |

## 3. Common handler pattern

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, checkRateLimit, clientKey, forbidden, tooManyRequests } from "@/lib/auth/route-security";

export async function POST(req: NextRequest) {
  // 1. Auth + CSRF
  const user = await requireRequestUser(req);
  if ("_response" in user) return user._response;

  // 2. Rate limit
  if (!checkRateLimit(`upload:${clientKey(req)}`, 20, 60_000)) {
    return tooManyRequests();
  }

  // 3. Do the work, scoped to user.schoolId
  // ...

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

## 4. Result verification payload

`GET /api/verify?code=XXXXXXXX`

```json
{
  "valid": true,
  "student": "...",
  "school": { "name": "...", "logo": "...", "motto": "..." },
  "session": "2025/2026",
  "term": "First",
  "overallAverage": 72.4,
  "overallPosition": 3,
  "subjects": [
    { "subject": "Mathematics", "score": 70, "grade": "B2", "position": 1 }
  ]
}
```

## 5. Upload contract

`POST /api/upload` (multipart, field `file`):
- Response: `{ url, name, size, mimetype }`.
- Accepts only allowlisted image/doc types within 5 MB.
- Returns `413`/`400`/`429`/`403` on violations.

## 6. Deployment / jobs

- `process-queue` is intended to be called from a scheduler (e.g. Vercel Cron or a cron job) authenticated with the `CRON_SECRET` bearer header.

## 7. Adding a new API route — checklist

1. Same-origin + auth (`requireRequestUser`) unless genuinely public.
2. Rate limit via `checkRateLimit` keyed on `clientKey(req)`.
3. Scope every query to `user.schoolId`.
4. Never log secrets or full payloads.
5. For writes, prefer a Server Action instead unless a public/HTTP endpoint is truly required.