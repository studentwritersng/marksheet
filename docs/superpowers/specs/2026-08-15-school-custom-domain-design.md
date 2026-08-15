# Custom Domain White-Label for Schools (Model A)

**Date:** 2026-08-15
**Status:** Approved design — pending implementation plan

## Objective

Allow a registered school to be reached via its own standalone domain (e.g.
`portal.stmarys.sch.ng`) while running on the **same shared application**
(currently hosted on Vercel, behind Cloudflare DNS/proxy). Visitors to the
school's domain see that school's branding and data; the school runs nothing
of its own. This reuses the platform's existing per-school scoping.

This is **Model A (shared multi-tenant app)** — not a separate deployment.
(Moving a school to its own Cloudflare Workers instance with a separate DB is
explicitly out of scope; the codebase assumes one shared DB partitioned by
`schoolId`.)

## Current State (verified in code)

- `School` (Prisma) has **no** domain field and there is **no `middleware.ts`**.
- School scoping already exists two ways:
  - **Path-based:** `src/app/[shortcode]/verify/page.tsx:12` and
    `src/app/login/[shortcode]/page.tsx:17` resolve the school via
    `prisma.school.findUnique({ where: { shortcode: shortcode.toUpperCase() } })`.
  - **User-based:** authenticated `(app)` routes derive `ctx.schoolId` from the
    logged-in user's `schoolId` (see `src/app/console/login/actions.ts:47`).
- `next.config.ts` has **no `allowedHosts`**. On Next.js 15+ an unlisted host is
  blocked, so custom domains will not work until this is addressed.
- The CSP in `next.config.ts` references `*.blob.vercel-storage.com`, strongly
  implying **Vercel hosting** behind Cloudflare.

## Approach

**Approach 1 — Host → school resolution in public pages (no Edge middleware).**

Next.js middleware runs on the Edge runtime where Prisma cannot run, so the
`host → school` lookup is done inside Node server-component pages that already
use Prisma. Behavior is identical to a middleware rewrite but avoids the
Edge/Prisma problem and reuses existing clients.

- Public surfaces (`/login`, `/verify`, `/`) resolve the school from the
  `Host` header and render the **existing** branded components.
- Authenticated `(app)` routes are unchanged: they are already scoped by the
  logged-in user's `schoolId`, and a user on a school domain *is* that school's
  user. Branding (logo/name) already comes from school settings.

## Data Model

Add to the `School` model in `prisma/schema.prisma`:

```prisma
customDomain         String? @unique // bare lowercase hostname, e.g. "portal.stmarys.sch.ng"
customDomainVerified Boolean @default(false)
customDomainToken    String? // random token for DNS-ownership verification
```

Rationale for `@unique`: middleware/pages do `findUnique` by `customDomain`;
uniqueness also prevents two schools claiming the same domain.

## Domain Resolution

New module `src/lib/school-domain.ts`:

- `normalizeDomain(host: string): string` — lowercase, strip scheme, strip
  `www.` prefix, drop any `:port`.
- `getSchoolByRequestHost(host: string)` — `prisma.school.findUnique({
  where: { customDomain: normalizeDomain(host) }, select: { id, name, logo,
  motto, shortcode, customDomainVerified } })`.
- `isMainDomain(host: string): boolean` — compares against `process.env.MAIN_DOMAIN`
  (e.g. `marksheet.com` / `app.marksheet.com`). Used so the main domain keeps
  normal behavior.

## Public Page Behavior (school domain)

- **New `src/app/login/page.tsx`** (top-level): if `Host` resolves to a verified
  school, render `SchoolLoginForm` (imported from `login/[shortcode]/login-form`)
  with that school's `id`/`name`/`logo`/`motto`. Otherwise fall back to existing
  behavior (redirect to `/login/[shortcode]` picker or main login).
- **New `src/app/verify/page.tsx`** (top-level): if `Host` resolves to a verified
  school, render `VerifyClient` (from `[shortcode]/verify/client`) with that
  school. Otherwise keep existing `/verify` behavior.
- **`/` on a school domain** → `redirect("/login")` (which then resolves by host).
- If `Host` matches a stored `customDomain` but `customDomainVerified` is false,
  or no school matches, return `notFound()` (do not leak other schools).

These pages reuse the existing client components; no UI duplication.

## `allowedHosts`

In `next.config.ts` add:

```ts
const nextConfig: NextConfig = {
  allowedHosts: ["all"],
  // ...existing config
};
```

Security note: `allowedHosts: ["all"]` disables Next's built-in host
allowlist. This is acceptable here because (a) traffic is behind Cloudflare's
proxy and (b) all host-based trust decisions are made explicitly in app code
(`getSchoolByRequestHost` only matches a stored, verified `customDomain`).
Document this tradeoff in the spec/code comments. If a tighter option is
desired later, the domain list can be generated into `allowedHosts` at build
time, but `"all"` is simplest for an arbitrary number of school domains.

## Authenticated App Guard

Add a light check in the `(app)` root layout (or a shared server guard):
if `request.host` resolves (via `getSchoolByRequestHost`) to a school **and**
the logged-in user's `schoolId` ≠ that school's id (e.g. platform owner or a
different school's user), `redirect()` to the main domain. This keeps
cross-school/admin users out of a school's white-label context while letting
the school's own users operate normally (their `schoolId` already matches).

## Admin UX — Configuring a School Domain

In the platform console school editor (`/console/(main)/schools/[id]`, with the
existing `schools-page-client` / detail page):

1. A "Custom Domain" input + "Generate token" action that sets
   `customDomainToken` (random, e.g. `crypto.randomBytes(16).toString("hex")`).
2. After the admin enters the domain, show instructions:
   - DNS: `CNAME`/`ALIAS` the domain → platform hostname (Vercel target).
   - TXT: `_marksheet-challenge.<domain>` = `<customDomainToken>`.
3. A "Verify domain" action that:
   - Performs a DNS `TXT` lookup for `_marksheet-challenge.<domain>` (Node:
     `dns.promises.resolveTxt`; in server action context), compares to the token.
   - On success: sets `customDomain = normalized(domain)`,
     `customDomainVerified = true`.
   - On failure: reports that DNS is not yet correct.

This verification prevents School A from claiming School B's domain.

(New server actions live alongside the existing school admin actions; naming
follows the `...Action` convention.)

## Cloudflare + Vercel Setup (operational steps)

Both the platform domain and the school domain are managed in Cloudflare.

1. **Cloudflare — add the school domain** as a **Custom Hostname / SSL for SaaS**
   entry on the existing platform zone (Cloudflare auto-issues the certificate
   for it), *or* as its own zone if preferred.
2. **DNS:** school domain `CNAME`/`ALIAS` → the Vercel project target
   (`cname.vercel-dns.com` or the project-specific value), **proxy = orange
   cloud** (Cloudflare terminates TLS and forwards to Vercel).
3. **SSL/TLS mode:** Full (Strict).
4. **Vercel:** add the school domain to the project (Project → Domains) so
   Vercel routes it. With Cloudflare proxying, Vercel's DNS check passes.
5. **If the school runs their own Cloudflare zone:** they add the CNAME target
   and the TXT challenge you provide; you add the Custom Hostname in your zone.

Cloudflare Workers are **not** required for Model A. (The platform owner's
note about Workers' free tier relates to a separate per-school deployment,
which is out of scope for this design.)

## Testing

- **Unit** (`src/lib/school-domain.test.ts`):
  - `normalizeDomain` strips scheme/port/`www.`.
  - `getSchoolByRequestHost` returns the school for a matching verified domain
    and `null` for unknown/unverified (mock Prisma).
  - `isMainDomain` logic.
- **Manual / integration:**
  - Set a school's `customDomain` + `customDomainVerified=true`.
  - Request `/verify` and `/login` with `Host: <school domain>` → resolves to
    the correct school (branded).
  - Log in as that school's user → authenticated app shows correct school
    branding and data.
  - Log in as platform owner on the school domain → redirected to main domain
    (guard).
  - Unverified/unknown domain → `notFound()`.
  - `allowedHosts: ["all"]` permits the custom domain (no 421/blocked host).

## Out of Scope

- Separate per-school deployments / Cloudflare Workers instances.
- Email sending from the school domain (SPF/DKIM) — can be a follow-up.
- Per-school theming beyond existing logo/name/motto (colors if added later).
- Automated cert/DNS provisioning beyond the TXT ownership check.

## Risks / Notes

- `allowedHosts: ["all"]` broadens accepted hosts; mitigated by app-level host
  validation. Revisit if a stricter approach is required.
- Host header can be spoofed; that only maps a visitor to a *public, read-only*
  school page (verify) or that school's branded login — no cross-school data
  exposure, since authenticated routes are scoped by the user's own `schoolId`.
