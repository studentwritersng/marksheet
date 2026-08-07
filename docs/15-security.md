# 15 — Security

This document consolidates the security model. It's the most important reading for anyone modifying access-controlled code.

## 1. Threat model

Marksheet is multi-tenant: multiple schools share one database. The dominant risk is **cross-tenant data exposure (IDOR)** — one school/role accessing another's data — followed by brute-force attacks, CSRF, malicious uploads, and secret leakage. The codebase has had explicit hardening passes (see git history: "harden auth, IDOR, rate limiting, uploads, sessions, CSRF" and "close cross-tenant IDOR gaps across ... actions").

## 2. The three "always" rules

1. **Auth first** — never trust the client; verify the session before anything.
2. **Scope every query with `schoolId`** — the caller's `schoolId` from the session.
3. **Verify referenced IDs belong to the caller** before creating relations (the IDOR guard).

### The IDOR guard pattern (must use)

In every server action, before mutating, confirm each referenced entity belongs to `ctx.schoolId`:

```ts
const [subject, term] = await Promise.all([
  prisma.subject.findFirst({ where: { id: subjectId, schoolId: ctx.schoolId }, select: { id: true } }),
  prisma.term.findFirst({ where: { id: termId, session: { schoolId: ctx.schoolId } }, select: { id: true } }),
]);
if (!subject || !term) return { error: "Invalid reference." };
```

*Why `findFirst` with `schoolId` and not `findUnique`?* `findUnique` only checks `id`; `findFirst({ where: { id, schoolId } })` also enforces tenancy in a single query.

## 3. Authentication & sessions

- Signed cookie session (`HMAC-SHA256` with `AUTH_SECRET`), constant-time verification, 4h TTL + 24h absolute cap, `httpOnly`, `sameSite=lax`, `secure` on non-local.
- Session fixation mitigated via per-issue nonce.
- See [03-authentication.md](./03-authentication.md).

## 4. CSRF

- `sameSite=lax` cookie mitigates most CSRF.
- Defence-in-depth: all `/api/*` state-changing handlers reject **cross-origin** requests via `requireRequestUser(req)` / `isSameOrigin(req)` (compares `Origin` host to request `Host`/`x-forwarded-host`).

## 5. Rate limiting

- In-memory sliding window (`route-security.ts`): `checkRateLimit(key, limit, windowMs)`.
- Login: `checkLoginRateLimit(email)` — 5 attempts/email/10 min + 20/instance/min.
- Uploads: per-IP limit.
- Unread-notifications endpoint: rate-limited.
- **Known limitation:** in-memory = per-process. For multi-instance production, replace with a Redis-backed limiter (same call signature), e.g. Upstash.

## 6. Upload hardening (`/api/upload`)

- Authenticated + same-origin only.
- **5 MB** size cap.
- Extension + MIME allowlist: `png` `jpg` `jpeg` `webp` `gif` `svg` `pdf` only.
- Filename sanitisation (strips dangerous chars).
- Path-traversal guard (reject `..`, absolute paths).
- Per-IP rate limit.
- Stores to Vercel Blob (prod) or `public/uploads` (local).

## 7. At-rest secrets

- AI provider keys and notification/WhatsApp/SMS provider credentials are **encrypted at rest** with AES-256-GCM (`src/lib/secrets.ts`; key from `ENCRYPTION_KEY` → `AUTH_SECRET`).
- Never log secrets or decrypted keys.
- Rotating the encryption key invalidates stored secrets — do it deliberately.

## 8. HTTP security headers (`next.config.ts`)

Applied globally via `headers()`:

- `Content-Security-Policy`: restrictive — `default-src 'self'`; inline scripts/styles allowed for Next.js + print styles; images allow `data:`/`blob:`/Vercel Blob; fonts Google/Gstatic; `frame-ancestors 'self'`; `object-src 'none'`.
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS, preload)
- `Referrer-Policy`
- `Permissions-Policy` (camera, mic, geolocation, payment, USB — all disabled).

## 9. Multi-tenancy elsewhere

- Route groups guard whole areas (see [03-authentication.md](./03-authentication.md), §4.3).
- API handlers scope by `user.schoolId`.
- Group/proprietor scope uses `proprietorGroupId` and group addon checks (never cross groups).
- `super_admin`/`platform_owner` explicitly bypass tenancy via `resolvePermissions`.

## 10. Input handling

- Prisma parameterises queries — no SQL injection via the ORM.
- JSON fields parsed defensively (`json-utils.ts`).
- MCQ answers / scores validated on the server (actions).
- Never render user content without escaping; React escapes by default. Be careful if using `dangerouslySetInnerHTML` (report cards) — do not feed unescaped user HTML.

## 11. Secret hygiene

- `.env*` git-ignored; `.env.example` holds names only.
- Decrypted secrets exist only transiently in memory during a request.

## 12. Checklist for new code

- [ ] Guard: `requireSchoolAdmin()` / `requireExamReviewer()` / role check.
- [ ] License: `guardActiveLicense(ctx.schoolId)` for paid features.
- [ ] Every referenced ID validated with `findFirst({ where: { id, schoolId } })`.
- [ ] All queries filtered by `ctx.schoolId` (or proprietor group).
- [ ] `recordAudit()` on mutations.
- [ ] Rate limit any abuse-prone endpoint.
- [ ] Origin check (CSRF) for any `/api/*` state change.
- [ ] No secrets logged; sensitive config encrypted at rest.