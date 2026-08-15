# School Custom-Domain White-Label (Model A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a school be reached via its own standalone domain (e.g. `portal.stmarys.sch.ng`) on the shared Vercel app, showing that school's branding/data, with no separate deployment.

**Architecture:** Add a `customDomain` (unique, verified) to `School`. Public pages (`/login`, `/verify`, `/`) resolve the school from the `Host` header in Node server components and render the existing branded components (`SchoolLoginForm`, `VerifyClient`). Authenticated `(app)` routes stay user-scoped (already partitioned by `schoolId`); a light guard redirects cross-school users off a school domain. `next.config` allows the host.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions), Prisma, Vitest, Cloudflare (DNS/SSL for SaaS) + Vercel (domain).

## Global Constraints

- Multi-tenant single DB: every query must stay scoped by `schoolId`; never expose another school's data. (Copied from spec.)
- Custom-domain pages only trust a `customDomain` that is stored AND `customDomainVerified === true`. (Spec §2, §4.)
- `allowedHosts: ["all"]` is set; all host-based trust is done explicitly in app code, not by Next's allowlist. (Spec §3.)
- Reuse existing components `SchoolLoginForm` (`src/app/login/[shortcode]/login-form.tsx`) and `VerifyClient` (`src/app/[shortcode]/verify/client.tsx`) — do not duplicate UI. (Spec §2.)
- Follow existing server-action conventions: `"use server"` file, `SchoolActionResult` return type, `guard()` that requires `platform_owner`, `revalidatePath`. (Observed in `src/app/console/(main)/schools/[id]/actions.ts`.)
- Env: add `MAIN_DOMAIN` (e.g. `marksheet.com`) to environment config; never hardcode hostnames.

---

### Task 1: Add `customDomain` fields to `School` + migration

**Files:**
- Modify: `prisma/schema.prisma` (inside `model School`)
- Create: migration via `prisma migrate dev` (generated, not hand-written)

**Interfaces:**
- Produces: Prisma fields `customDomain`, `customDomainVerified`, `customDomainToken` on `School`, available to all later tasks.

- [ ] **Step 1: Add fields to the `School` model**

In `prisma/schema.prisma`, inside `model School` (after an existing field such as `suspended`), add:

```prisma
  // Custom white-label domain (Model A). Bare lowercase hostname, unique.
  customDomain         String? @unique
  customDomainVerified Boolean @default(false)
  customDomainToken    String?
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
npx prisma migrate dev --name add_school_custom_domain
```
Expected: migration created and applied; `prisma generate` runs; client now has the three fields.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (no new code yet, just schema).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add customDomain fields to School"
```

---

### Task 2: `school-domain` lib + unit tests (TDD)

**Files:**
- Create: `src/lib/school-domain.ts`
- Create: `src/lib/school-domain.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces:
  - `normalizeDomain(host: string): string`
  - `getSchoolByRequestHost(host: string): Promise<{ id: string; name: string; logo: string | null; motto: string | null; shortcode: string } | null>`
  - `isMainDomain(host: string): boolean`

- [ ] **Step 1: Write the failing test**

`src/lib/school-domain.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { school: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { normalizeDomain, getSchoolByRequestHost, isMainDomain } from "./school-domain";

describe("normalizeDomain", () => {
  it("lowercases, drops scheme, port and www", () => {
    expect(normalizeDomain("https://WWW.Portal.StMarys.sch.ng:3000/")).toBe("portal.stmarys.sch.ng");
    expect(normalizeDomain("PORTAL.STMARYS.SCH.NG")).toBe("portal.stmarys.sch.ng");
  });
});

describe("getSchoolByRequestHost", () => {
  it("returns the school for a matching verified domain", async () => {
    (prisma.school.findUnique as any).mockResolvedValue({
      id: "s1", name: "St Marys", logo: null, motto: null, shortcode: "SMS", customDomainVerified: true,
    });
    const s = await getSchoolByRequestHost("portal.stmarys.sch.ng");
    expect(s?.id).toBe("s1");
    expect(s?.shortcode).toBe("SMS");
  });

  it("returns null when no school matches", async () => {
    (prisma.school.findUnique as any).mockResolvedValue(null);
    expect(await getSchoolByRequestHost("nope.example.com")).toBeNull();
  });

  it("returns null when the domain is stored but not verified", async () => {
    (prisma.school.findUnique as any).mockResolvedValue({
      id: "s1", name: "X", logo: null, motto: null, shortcode: "X", customDomainVerified: false,
    });
    expect(await getSchoolByRequestHost("portal.stmarys.sch.ng")).toBeNull();
  });
});

describe("isMainDomain", () => {
  it("treats MAIN_DOMAIN and localhost as main", () => {
    process.env.MAIN_DOMAIN = "marksheet.com";
    expect(isMainDomain("marksheet.com")).toBe(true);
    expect(isMainDomain("localhost:3000")).toBe(true);
    expect(isMainDomain("portal.stmarys.sch.ng")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/school-domain.test.ts`
Expected: FAIL (`Cannot find module './school-domain'`).

- [ ] **Step 3: Implement `src/lib/school-domain.ts`**

```ts
import { prisma } from "@/lib/prisma";

export function normalizeDomain(host: string): string {
  let h = host.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "");
  h = h.split("/")[0];
  h = h.split(":")[0];
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

const MAIN = (process.env.MAIN_DOMAIN || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];

export function isMainDomain(host: string): boolean {
  const h = normalizeDomain(host);
  if (h === "localhost" || h.startsWith("localhost:")) return true;
  if (h.endsWith(".vercel.app")) return true;
  if (MAIN && h === MAIN) return true;
  return false;
}

export async function getSchoolByRequestHost(
  host: string,
): Promise<{ id: string; name: string; logo: string | null; motto: string | null; shortcode: string } | null> {
  const domain = normalizeDomain(host);
  if (!domain || isMainDomain(domain)) return null;
  const school = await prisma.school.findUnique({
    where: { customDomain: domain },
    select: { id: true, name: true, logo: true, motto: true, shortcode: true, customDomainVerified: true },
  });
  if (!school || !school.customDomainVerified) return null;
  return {
    id: school.id,
    name: school.name,
    logo: school.logo,
    motto: school.motto,
    shortcode: school.shortcode,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/school-domain.test.ts`
Expected: PASS (3 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-domain.ts src/lib/school-domain.test.ts
git commit -m "feat(domain): add school-domain resolution lib + tests"
```

---

### Task 3: Allow custom hosts in `next.config.ts`

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `allowedHosts: ["all"]` so custom school domains are not blocked by Next 15.

- [ ] **Step 1: Add `allowedHosts`**

In `next.config.ts`, change the `nextConfig` object to:

```ts
const nextConfig: NextConfig = {
  allowedHosts: ["all"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(config): allow custom school domains via allowedHosts"
```

---

### Task 4: `/login` resolves school by host

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `getSchoolByRequestHost` (Task 2), `SchoolLoginForm` from `@/app/login/[shortcode]/login-form` (props `{ schoolId: string; schoolName: string }`).
- Produces: on a school domain, the login page renders the branded `SchoolLoginForm` instead of the school picker.

- [ ] **Step 1: Rewrite `src/app/login/page.tsx`**

Replace the file content with:

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSchoolByRequestHost } from "@/lib/school-domain";
import { SchoolSearchForm } from "./search-form";
import { SchoolLoginForm } from "../[shortcode]/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "proprietor") redirect("/proprietor");
    redirect("/dashboard");
  }

  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);

  if (school) {
    return (
      <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center overflow-hidden">
              {school.logo ? (
                <img src={school.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              )}
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{school.name}</h1>
            {school.motto && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{school.motto}</p>
            )}
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <SchoolLoginForm schoolId={school.id} schoolName={school.name} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Marksheet</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Find your school to sign in
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <SchoolSearchForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(domain): brand /login by host for school domains"
```

---

### Task 5: `/verify` resolves school by host

**Files:**
- Modify: `src/app/verify/page.tsx` (convert to server component)
- Create: `src/app/verify/generic-verify-client.tsx` (extract current client UI)

**Interfaces:**
- Consumes: `getSchoolByRequestHost` (Task 2), `VerifyClient` from `@/app/[shortcode]/verify/client` (props `{ schoolName; schoolLogo; schoolMotto; shortcode; initialCode }`).
- Produces: on a school domain, `/verify` renders the branded `VerifyClient`; on the main domain it renders the generic verify UI.

- [ ] **Step 1: Extract generic UI into `src/app/verify/generic-verify-client.tsx`**

Move the current body of `src/app/verify/page.tsx` (the `"use client"` component that fetches `/api/verify?code=`) into a new file `generic-verify-client.tsx`, exporting `GenericVerifyClient`. Keep it as a client component.

- [ ] **Step 2: Rewrite `src/app/verify/page.tsx` as a server component**

```tsx
import { headers } from "next/headers";
import { getSchoolByRequestHost } from "@/lib/school-domain";
import { VerifyClient } from "../[shortcode]/verify/client";
import { GenericVerifyClient } from "./generic-verify-client";

export default async function VerifyPage() {
  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);

  if (school) {
    return (
      <VerifyClient
        schoolName={school.name}
        schoolLogo={school.logo}
        schoolMotto={school.motto}
        shortcode={school.shortcode}
        initialCode=""
      />
    );
  }

  return <GenericVerifyClient />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/verify/page.tsx src/app/verify/generic-verify-client.tsx
git commit -m "feat(domain): brand /verify by host for school domains"
```

---

### Task 6: Root `/` redirects school domains to `/login`

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getSchoolByRequestHost` (Task 2).
- Produces: visiting `/` on a school domain redirects to `/login` (which then brands by host).

- [ ] **Step 1: Add host check at the top of the default export**

In `src/app/page.tsx`, after the existing imports, change the default export to begin with:

```tsx
export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);
  if (school) redirect("/login");

  // ...existing landing-page rendering unchanged below...
}
```

Add `import { headers } from "next/headers";` and `import { getSchoolByRequestHost } from "@/lib/school-domain";` and ensure `redirect` is already imported (it is, via `next/navigation`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(domain): redirect school-domain root to /login"
```

---

### Task 7: Guard authenticated `(app)` routes on school domains

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getSchoolByRequestHost` (Task 2), `getCurrentUser` from `@/lib/auth/current-user`.
- Produces: a logged-in user whose `schoolId` differs from the host's school (incl. platform owner with no school) is redirected to the main domain.

- [ ] **Step 1: Add the guard in the `(app)` layout**

In `src/app/(app)/layout.tsx`, inside the server component (where the current user is already fetched, or fetch it), add before rendering children:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSchoolByRequestHost } from "@/lib/school-domain";
import { getCurrentUser } from "@/lib/auth/current-user";

// ...within the layout function, after `const user = await getCurrentUser();` (or fetch it):
const host = (await headers()).get("host") ?? "";
const hostSchool = await getSchoolByRequestHost(host);
if (hostSchool && user && user.schoolId && user.schoolId !== hostSchool.id) {
  const main = process.env.MAIN_DOMAIN || "localhost:3000";
  redirect(`https://${main}/dashboard`);
}
```

Note: if the layout does not already call `getCurrentUser`, add it; otherwise reuse the existing `user` variable. The guard only fires when `hostSchool` exists (i.e. we are on a school domain) and the user belongs to a different school.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat(domain): guard app routes against cross-school host access"
```

---

### Task 8: Admin UI — configure & verify a school's custom domain

**Files:**
- Modify: `src/app/console/(main)/schools/[id]/page.tsx` (add fields to select + VM)
- Modify: `src/app/console/(main)/schools/[id]/client.tsx` (add `customDomain*`, UI card, wire actions)
- Modify: `src/app/console/(main)/schools/[id]/actions.ts` (add 3 actions)

**Interfaces:**
- Consumes: `SchoolActionResult` and `guard()` (existing in `actions.ts`), `prisma`, `revalidatePath`.
- Produces: admin can set a domain, generate a verification token + DNS instructions, verify ownership via TXT lookup, and clear the domain.

- [ ] **Step 1: Add select fields in `page.tsx`**

In the `prisma.school.findUnique` `select` block add:
```ts
      customDomain: true,
      customDomainVerified: true,
      customDomainToken: true,
```
And extend the `SchoolVM` passed to `SchoolDetailClient` with `customDomain: school.customDomain, customDomainVerified: school.customDomainVerified, customDomainToken: school.customDomainToken`.

- [ ] **Step 2: Add the three server actions in `actions.ts`**

Append to `src/app/console/(main)/schools/[id]/actions.ts`:

```ts
import dns from "node:dns";

function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
}

export async function configureCustomDomainAction(
  schoolId: string,
  formData: FormData,
): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const raw = (formData.get("domain") as string || "").trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "Enter a valid domain, e.g. portal.school.com" };
  const token = randomToken();
  await prisma.school.update({
    where: { id: schoolId },
    data: { customDomain: domain, customDomainToken: token, customDomainVerified: false },
  });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: `Add the TXT record _marksheet-challenge.${domain} = ${token}, then click Verify.` };
}

export async function verifyCustomDomainAction(schoolId: string): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { customDomain: true, customDomainToken: true } });
  if (!school?.customDomain || !school.customDomainToken) return { error: "Configure the domain first." };
  try {
    const records = await dns.promises.resolveTxt(`_marksheet-challenge.${school.customDomain}`);
    const flat = records.flat().join("");
    if (flat !== school.customDomainToken) return { error: "TXT record not found or does not match. Wait for DNS propagation and retry." };
  } catch {
    return { error: "TXT record not found. Wait for DNS propagation and retry." };
  }
  await prisma.school.update({ where: { id: schoolId }, data: { customDomainVerified: true } });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: "Domain verified. Point DNS (CNAME/ALIAS) to the platform and add it in Vercel." };
}

export async function clearCustomDomainAction(schoolId: string): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.school.update({ where: { id: schoolId }, data: { customDomain: null, customDomainVerified: false, customDomainToken: null } });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: "Custom domain cleared." };
}
```

Note: `crypto.getRandomValues` is available globally in Node 18+; if not, use `import { randomBytes } from "node:crypto"` and `randomBytes(16).toString("hex")`.

- [ ] **Step 3: Extend `SchoolVM` and UI in `client.tsx`**

Add to the `SchoolVM` interface:
```ts
  customDomain: string | null;
  customDomainVerified: boolean;
  customDomainToken: string | null;
```
Add the three actions to the import from `./actions`. Add `useActionState` hooks for `configureCustomDomainAction`, `verifyCustomDomainAction`, `clearCustomDomainAction`. Render a "Custom Domain" card showing: current domain + verified badge, an input + "Save domain" button (configure), the TXT instruction when a token exists, a "Verify" button, and a "Clear" button. Use `revalidatePath` already handled server-side; the form re-renders from `editState`/`success`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/console/(main)/schools/[id]/page.tsx" "src/app/console/(main)/schools/[id]/client.tsx" "src/app/console/(main)/schools/[id]/actions.ts"
git commit -m "feat(admin): configure and verify school custom domain"
```

---

### Task 9: Operational setup doc (Cloudflare + Vercel) + `MAIN_DOMAIN` env

**Files:**
- Create: `docs/school-custom-domain-setup.md`
- Modify: `.env.example` (and add `MAIN_DOMAIN` to your environment config / Vercel env var)

**Interfaces:**
- Consumes: the behavior implemented in Tasks 1–8.
- Produces: a runbook the platform owner follows per school, and the `MAIN_DOMAIN` env var the guard (Task 7) and `isMainDomain` (Task 2) require.

- [ ] **Step 1: Document the Cloudflare + Vercel steps**

Create `docs/school-custom-domain-setup.md` with the operational steps from spec §6:
1. In Cloudflare, add the school domain as a Custom Hostname / SSL for SaaS entry on the platform zone (auto-issued cert), or as its own zone.
2. DNS: school domain `CNAME`/`ALIAS` → Vercel target (`cname.vercel-dns.com`), proxy = orange cloud.
3. SSL/TLS mode: Full (Strict).
4. Vercel: add the school domain to the project (Project → Domains).
5. If the school runs their own Cloudflare zone: they add the CNAME target + the `_marksheet-challenge.<domain>` TXT you provide; you add the Custom Hostname.
6. In the platform console (`/console/schools/[id]`), set the domain, add the TXT record, click Verify.

- [ ] **Step 2: Add `MAIN_DOMAIN` to env**

In `.env.example` add:
```
# Bare hostname of the primary platform domain (no scheme/port), e.g. marksheet.com
MAIN_DOMAIN=marksheet.com
```
Also set `MAIN_DOMAIN` in the deployed environment (Vercel project env var) to the real production hostname.

- [ ] **Step 3: Commit**

```bash
git add docs/school-custom-domain-setup.md .env.example
git commit -m "docs: add school custom-domain Cloudflare/Vercel setup runbook + MAIN_DOMAIN"
```

---

### Task 10: Final verification

**Files:** none new.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (includes `src/lib/school-domain.test.ts`).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: exit 0.

- [ ] **Step 3: Manual smoke checklist (document results, do not automate)**

- Set a school's `customDomain` + `customDomainVerified=true` directly (or via the admin UI + a real TXT record).
- `GET /verify` with `Host: <school domain>` → renders that school's branded verify (URL stays clean).
- `GET /login` with `Host: <school domain>` → renders that school's branded login.
- `GET /` with `Host: <school domain>` → redirects to `/login`.
- Log in as that school's user → authenticated app shows correct school branding/data.
- Log in as platform owner on the school domain → redirected to main domain.
- Unknown / unverified domain as `Host` → normal behavior (no school leaked; `notFound` only where applicable).

- [ ] **Step 4: Commit (if any fix from manual checks)**

```bash
git add -A
git commit -m "fix(domain): address issues found in manual smoke test"
```
(Only if changes were required.)

---

## Self-Review Notes

- Spec coverage: data model (T1), resolution lib (T2), allowedHosts (T3), public `/login`+`/verify`+`/` (T4–T6), authenticated guard (T7), admin UX + DNS verification (T8), Cloudflare/Vercel runbook + env (T9), testing (T2, T10). All spec sections mapped.
- No placeholders: every task has concrete code or exact file edits.
- Type consistency: `getSchoolByRequestHost` return shape `{ id, name, logo, motto, shortcode }` matches what T4/T5/T6 consume; `SchoolActionResult` reused from existing `actions.ts`; VM fields added in T8 match `page.tsx` select.
