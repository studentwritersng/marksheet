# 03 — Authentication, Roles & Permissions

## 1. Overview

Authentication is fully custom — no NextAuth, no JWT library, no auth.js. A session is a **signed cookie** containing the user's identity, verified with HMAC-SHA256 on every request. Authorisation is **role + assignment based** and enforced at every entry point (guard layouts, server actions, route handlers).

```
Login form
   │  (email + password)
   ▼
auth/actions.ts  ──►  bcrypt.compare(passwordHash)
   │  success
   ▼
createSessionToken(payload)  ──►  cookie "marksheet_session"
   │                              httpOnly · sameSite=lax · 4h TTL
   ▼
Every request: cookies() ──► verifySessionToken(token)
   │  (HMAC verify + exp check + 24h absolute cap)
   ▼
getCurrentUser()  ──►  SessionPayload  ──►  guard layouts / server actions
```

## 2. Roles

There are **7 roles**, defined by the `UserRole` enum on the `User` model.

| Role | `schoolId` | What they can do | Where |
|---|---|---|---|
| `super_admin` | `null` | Everything; may act inside any school | Platform operations, cross-school views |
| `platform_owner` | `null` | Owns/operates the product | `/console/*` |
| `proprietor` | `null` | Owns a group of schools (Multi-Branch addon) | `/proprietor/*` |
| `staff` | set | Teachers, admins, exam officers, receptionists — access derived from **Assignments** | `/dashboard`, `/exams`, ... |
| `student` | set | Take exams, view own results | `/my-exams`, `/my-results` |
| `parent` | set | View wards' reports/attendance | `/parent/*` |
| `referral` | `null` | Market the product, earn commission | `/referral/dashboard` |

## 3. Sessions

File: `src/lib/auth/session.ts`

**Session payload** (`SessionPayload`):

```ts
{
  userId: string;
  role: "super_admin" | "platform_owner" | "proprietor" | "staff" | "student" | "parent" | "referral";
  schoolId: string | null;
  staffId: string | null;
  email: string;
  mustChangePassword: boolean;
  proprietorGroupId?: string | null;
  proprietorPermissionLevel?: "full" | "view_only" | null;
}
```

**Token format**: `base64url(JSON).base64url(HMAC-SHA256(JSON))`

- Signed with `AUTH_SECRET` (env var, 64 hex chars). Missing secret → throws at sign time.
- Includes a random nonce `sid` on every issuance (mitigates session fixation).
- `exp` = issued + 4 hours; also capped at an **absolute 24h** lifetime via `iat`, so rolling refreshes cannot extend a session forever.
- Verification uses `crypto.timingSafeEqual` (constant-time comparison).

**Cookie**: `marksheet_session`, options from `sessionCookieOptions()`:

- `httpOnly: true`, `sameSite: "lax"`, `path: "/"`
- `secure: true` when running on Vercel or `NODE_ENV=production` (i.e. any non-local environment)
- `maxAge: 4h`

**Reading the session** (`src/lib/auth/current-user.ts`):

```ts
const user = await getCurrentUser();          // SessionPayload | null
const user = await requireUser();             // throws "UNAUTHENTICATED" if absent
```

## 4. Guard helpers

### 4.1 Server-action guards — `src/lib/auth/guards.ts`

| Guard | Allows | Returns |
|---|---|---|
| `requireSchoolAdmin()` | `school_admin` assignment or `super_admin`/`platform_owner`, with a non-null `schoolId` | `{ user, perms, schoolId }` |
| `requireExamReviewer()` | `exam_officer` or school-admin/super | same |

Both **throw** on failure; callers wrap them in `try/catch` and return `{ error: "Not authorised." }`.

Helpers: `canReviewExams(perms)`, `canPublishExams(perms)`.

### 4.2 Platform-owner guards — `src/lib/auth/platform-owner.ts`

- `requirePlatformOwner()` — blocks unless role is `platform_owner`.
- `requireProprietor()` — blocks unless role is `proprietor`.

### 4.3 Guard layouts

There is **no middleware**. Route protection is enforced in layouts:

- `src/app/(app)/layout.tsx` — unauthenticated → `/login`; `proprietor` → `/proprietor`; school in maintenance mode → `/maintenance`; builds the role-scoped nav.
- `src/app/console/(main)/layout.tsx` — `platform_owner` only (else `/dashboard`).
- `src/app/proprietor/(console)/layout.tsx` — `proprietor` only; forces `/change-password` when `mustChangePassword` is true.

## 5. Assignment-based permissions — `src/lib/auth/permissions.ts`

Staff don't get a fixed permission label. Their effective permissions are the **union of active `Assignment` rows** for the current session/term.

**Assignment types** (`AssignmentType` enum):

`subject_teacher` · `class_teacher` · `hod` · `exam_officer` · `school_admin` · `fee_status_manager` · `receptionist`

**Rules for "active":**

- Belongs to the current session (`sessionId` matches current session) **or** is session-wide (`sessionId: null`).
- Not an expired temporary assignment (must be within `startDate`/`endDate`, or both null).

**What resolution produces** (`EffectivePermissions`):

```ts
{
  isSuperAdmin, isSchoolAdmin, isExamOfficer, isFeeStatusManager, isReceptionist: boolean;
  assignments: ResolvedAssignment[];
  subjectTeacherClassIds: Set<string>;  // classes I teach
  subjectTeacherSubjectIds: Set<string>;
  classTeacherClassIds: Set<string>;
  hodSubjectIds: Set<string>;
  visibleSubjectIds, visibleClassIds: Set<string>;  // derived scope for listings
}
```

`resolvePermissions(user)` is async (queries `session` + `assignment`) and is called by guard helpers and by `buildNav`.

> Because permissions come from `Assignment` rows, granting/revoking access is a data change (create/delete an assignment), not a code change.

## 6. Route-handler security — `src/lib/auth/route-security.ts`

Used by every `/api/*` route:

| Helper | Purpose |
|---|---|
| `requireApiUser()` | Returns the session user, or a `401` `NextResponse` |
| `requireRequestUser(req)` | `requireApiUser` + CSRF same-origin check (rejects cross-origin state changes with `403`) |
| `isSameOrigin(req)` / `isOriginAllowed(req)` | Compares `Origin` header host with request `Host`/`x-forwarded-host` |
| `checkRateLimit(key, limit, windowMs)` | In-memory sliding-window rate limiter |
| `clientKey(req)` | Identifies a client (IP from `x-forwarded-for`/`x-real-ip`) |
| `checkLoginRateLimit(email)` | Login-specific: 5 attempts/email/10 min, 20 attempts/instance/min; returns a friendly message or `null` |
| `forbidden()`, `unauthorized()`, `tooManyRequests()` | Standard `NextResponse` builders |

> **Limitation to know:** the rate limiter is in-memory and **per-process**. It's fine for single-instance deployments; for horizontally-scaled production, swap `checkRateLimit` for a Redis-backed limiter (e.g. Upstash) keeping the same signature.

## 7. Login / logout flows

Files: `src/lib/auth/actions.ts` plus per-area forms.

### 7.1 School login
- `/login` (search by school) → `/login/[shortcode]` (branded school form).
- Password verified with `bcryptjs` against `User.passwordHash`.
- On success: session cookie set; redirect by role.
- `checkLoginRateLimit(email)` throttles brute force.

### 7.2 Platform owner login — `/console/login`
- Same session mechanism; requires `platform_owner` role. No seeded owner — see [13-roles-consoles.md](./13-roles-consoles.md).

### 7.3 Proprietor login — `/proprietor/login`
- Requires `proprietor` role. If `mustChangePassword` is set, user is forced through `/proprietor/change-password`.

### 7.4 Referral login — `/referral/login`
- Agent credentials live on the `Referral` model (own `passwordHash`) **and** as a `User` with role `referral`.

### 7.5 Logout
- Clears the `marksheet_session` cookie. `/referral/logout` exists for agents.

## 8. Passwords

- Hashed with **bcrypt** (cost factor 12) via `src/lib/auth/password.ts`.
- `mustChangePassword` flag forces a change on next login (used for proprietor onboarding and admin-reset flows).
- `/change-password` (school users) and `/proprietor/change-password` allow self-service changes.

## 9. NDPR (data-protection) gating

`src/lib/ndpr/access.ts` enforces consent-aware access for student/guardian data (data-processing, photo-use, contact consent via `ConsentRecord`), rejecting access when required consent is missing. It also records an audit entry for denied/denied-silently data accesses.

## 10. Checklist when adding a new protected route

1. Add the route under the appropriate guard layout (or add a new guard layout for a new area).
2. In every server action, start with `requireSchoolAdmin()` / `requireExamReviewer()` / role checks, wrapped in `try/catch`.
3. In every route handler, use `requireRequestUser(req)` + rate limiting + origin checks.
4. Always scope DB queries with the caller's `schoolId` (see [15-security.md](./15-security.md)).
5. Call `recordAudit(...)` on mutations.
