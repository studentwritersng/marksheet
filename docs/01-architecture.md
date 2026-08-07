# 01 — System Architecture

## 1. What is Marksheet?

Marksheet is a **multi-tenant school management platform** for Nigerian secondary schools. It covers the full academic year loop:

- Curriculum management (NERDC-aligned) and syllabus tracking
- Lesson notes (manual and AI-generated)
- Timetable generation (addon)
- Question bank and exam delivery (online + offline sync)
- Score entry, grading, results computation and report cards
- Attendance (addon, QR-based)
- Fee-status gating
- Parent messaging and notifications
- Licensing, billing, addons and a referral program

Every tenant is a **School**. The platform also has three elevated tiers above a school: the **Platform Owner** (operates the whole product), the **Proprietor** (owns a group of schools via the Multi-Branch addon), and the **Referral agent** (markets the product for commission).

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server components + server actions; no middleware file |
| UI | **React 19**, Tailwind CSS 4 | Custom `mk-*` design tokens; Google Fonts via `<link>` |
| Language | TypeScript 5 | Strict; `@/*` path alias maps to `src/*` |
| ORM | Prisma 6 (`prisma-client-js`) | PostgreSQL |
| Database | PostgreSQL (Neon in prod, local Postgres in dev) | 90 models |
| Auth | Custom signed-cookie session | HMAC-SHA256, no auth library |
| Validation | Zod 4 + manual guards | Used in imports and some actions |
| AI | Provider-agnostic gateway | OpenRouter default; encrypted keys; call logging |
| Email | Nodemailer (SMTP) | Optional, via env vars |
| Notifications | In-app queue + WhatsApp/SMS providers | Twilio, Africa's Talking, custom |
| Files | Vercel Blob | Local fallback to `public/uploads` |
| Monitoring | Sentry | Server + client; tunneled through `/monitoring` |
| Reports | jsPDF, html2canvas, xlsx, papaparse | Client-side export/print |
| QR | `qrcode` (server), `html5-qrcode` (scan) | Verification + attendance cards |

## 3. High-level architecture

```
                     ┌──────────────────────────────┐
                     │   Next.js App (React 19)     │
                     │                              │
                     │  Server Components (RSC)     │
                     │  + Server Actions ("use server")
                     │  + Route Handlers (/api/*)   │
                     └───────┬──────────────┬───────┘
                             │              │
                    Prisma Client     External services
                             │              │
                     ┌───────┴───┐   ┌─────┴──────────────┐
                     │ PostgreSQL │   │ AI gateway (OpenRouter)
                     │ (Neon)     │   │ SMTP · Vercel Blob  │
                     └───────────┘   │ WhatsApp/SMS (addon) │
                                     └──────────────────────┘
```

There is **no separate API server**. Server Actions handle all authenticated mutations; route handlers (`src/app/api/*`) handle public endpoints (result verification), file upload, the notification queue job, and a few JSON lookups.

There is **no middleware file**. Route protection is enforced in each guard **layout** and inside every server action / route handler.

## 4. The multi-tenant model

Tenancy is enforced by the `schoolId` column that appears on nearly every domain model. Rules:

- A row belongs to exactly one school via its `schoolId`.
- Deleting a school **cascade-deletes** all of its data.
- Cross-tenant reads/writes are prevented two ways:
  1. **Scoping**: queries filter by `where: { schoolId: ctx.schoolId }` using the authenticated user's session.
  2. **Validation**: server actions verify every referenced entity (`findFirst({ where: { id, schoolId } })`) before creating relations.
- Platform-level roles (`super_admin`, `platform_owner`, `proprietor`, `referral`) have `schoolId = null` on their `User` row.
- `super_admin` may act within a school; every other school user is scoped to their own school.

> Security note: this is the single most important invariant in the codebase. See [15-security.md](./15-security.md) for the IDOR defense pattern.

## 5. Source layout

```
marksheet/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Authenticated school application (/dashboard, /exams, …)
│   │   ├── (marketing)/        # Public landing + legal pages
│   │   ├── api/                # Route handlers
│   │   ├── console/            # Platform Owner console
│   │   ├── proprietor/         # Proprietor (group of schools) console
│   │   ├── referral/           # Referral agent portal
│   │   ├── login/  register/  verify/  ...   # Public/auth top-level routes
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   └── page.tsx            # Landing page (role-based redirect)
│   ├── components/             # Shared client components
│   ├── lib/                    # Business logic (see below)
│   ├── instrumentation.ts      # Sentry server init
│   └── instrumentation-client.ts
├── prisma/
│   ├── schema.prisma           # 90 models, 17 enums
│   ├── migrations/             # SQL migrations (16)
│   ├── seed.ts                 # Demo/seed data (idempotent)
│   ├── nerdc-seed.ts           # NERDC curriculum topics
│   └── *.ts                    # helper scripts (encrypt-ai-keys, db-push-online)
├── public/                     # Static assets + local uploads
├── scripts/                    # Ops scripts
└── *.md                        # README, DEPLOY, planning notes
```

## 6. `src/lib` — the business-logic layer

Everything non-UI lives under `src/lib`, organized by domain:

```
src/lib/
├── prisma.ts               # Singleton PrismaClient (hot-reload safe)
├── audit.ts                # recordAudit() — immutable audit trail
├── nav.ts                  # Role-scoped navigation builder (buildNav)
├── license.ts              # License enforcement guard
├── grading-scale.ts        # Grading band helpers
├── landing-stats.ts        # Landing-page hero stats (auto/manual)
├── json-utils.ts           # JSON parse helpers
├── nerdc-subjects.ts       # NERDC subject constants
├── secrets.ts              # Encrypt/decrypt for at-rest secrets (AI keys)
├── addons/                 # Addon entitlement checks (per-school & group)
├── ai/                     # AI gateway + class-level guidance
├── attendance/             # Attendance server actions
├── auth/                   # Sessions, guards, permissions, route security, login actions
├── backup/                 # School export/import (JSON)
├── billing/                # Progressive/staged billing
├── class-subjects/         # ClassSubject actions
├── csv/                    # CSV import parsers (students, questions) + templates
├── email/                  # Nodemailer send helper
├── exams/                  # Exam lifecycle + essay grading (AI)
├── export/                 # CSV / DOC / PDF / XLSX exporters
├── fees/                   # Fee-status gate
├── license/                # Stage resolver (basic/standard/premium pricing)
├── ndpr/                   # NDPR data-access consent checks
├── notifications/          # Queue, providers, templates, event hooks
├── period-tracker/         # Taught-topic tracking actions
├── results/                # Result computation engine
├── tickets/                # Support-ticket actions
├── timetable/              # Manual actions + constraint solver
```

### Conventions in `src/lib`

- **Server actions**: files named `actions.ts` containing exported async functions annotated `"use server"`. They import `getCurrentUser` / `requireSchoolAdmin` style guards at the top.
- **Pure logic**: files like `results/compute.ts`, `timetable/solver.ts`, `ai/gateway.ts` contain no request/response code and are unit-testable.
- **Every mutation** calls `recordAudit(...)` with before/after JSON snapshots.
- **Path alias**: `@/lib/...` → `src/lib/...`.

## 7. Environments

| Env | Database | Notes |
|---|---|---|
| **Local dev** | Local Postgres (or Neon) | `npm run dev`, `DATABASE_URL` in `.env` |
| **Preview / staging** | Neon branch | Vercel preview deployments |
| **Production** | Neon (main) | Vercel or CyberPanel + PM2 |

Environment **names** used by the app (values live only in `.env*` files — see [02-setup.md](./02-setup.md)):

- `DATABASE_URL` — Postgres connection string
- `AUTH_SECRET` — HMAC secret for session cookies (64 hex chars)
- `AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL`, `AI_MOCK`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET` — bearer token for internal job endpoints
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (upload)
- `SENTRY_*` — error monitoring (via Sentry SDK)
- `VERCEL` — set automatically on Vercel; used for cookie `secure` flag

## 8. Key architectural decisions (and why)

1. **No middleware / no auth library.** Sessions are HMAC-signed cookies verified per-request. Keeps dependencies minimal and gives full control; requires every entry point to enforce its own guard.
2. **Server Actions for everything.** No client-side fetch wrapper, no tRPC/GraphQL. State flows through `useActionState` forms and server revalidation.
3. **Prisma `db push` over `migrate dev`.** `prisma migrate dev` fails against the Neon shadow database in this repo; manual migration SQL + `db push` is the working pattern (see [05-migrations.md](./05-migrations.md)).
4. **JSON columns for flexible data.** Grading scales, affective ratings, rubric points, timetable rules and bio-data are JSON, avoiding migrations during product iteration.
5. **Offline-first exam delivery.** `ExamAttempt.syncStatus` (`local_only`/`queued`/`synced`) and answer checksums support offline exam hubs.
6. **String-typed statuses.** Attendance, payment, fee and result statuses are strings with documented values rather than enums — again to avoid frequent migrations.

## 9. Data flow example — creating an exam

1. User fills the "New Exam" form on `/exams` (client component).
2. Form submits to `createExamAction` (server action in `src/lib/exams/actions.ts`).
3. The action: `requireSchoolAdmin()` → `guardActiveLicense()` → validates IDs belong to the school → creates `Exam` + `ExamClass` + `ExamQuestion` rows → `recordAudit()` → `revalidatePath("/exams")`.
4. The page re-renders server-side with the new exam in the list.

See [06-server-actions.md](./06-server-actions.md) for the full pattern.
