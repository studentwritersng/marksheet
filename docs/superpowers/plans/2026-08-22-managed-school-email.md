# Managed School Email (marksheet.top via Resend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every school's email from a unique `firstword@marksheet.top` address (display name = school name) via Resend SMTP, with zero school setup; schools may still optionally override with their own Gmail/SMTP.

**Architecture:** Keep the existing `nodemailer` sender. Add a "managed" transport that uses Resend's SMTP (`smtp.resend.com`, user `resend`, password = `RESEND_API_KEY`). `sendEmail` resolves: BYO-SMTP (if fully configured) → managed Resend (if `RESEND_API_KEY` set) → hard-block. The managed `from`/`replyTo` are computed from `school.name`/`school.email` — no DB change.

**Tech Stack:** TypeScript, Next.js (App Router, server actions), Prisma, nodemailer, Resend SMTP, vitest.

## Global Constraints

- No DB migration is required — the managed `from` address is computed from existing `school.name`/`school.email`/`school.shortcode`. Do not add columns.
- Per-school sender address = first word of `school.name`, lowercased + sanitized, + `@marksheet.top` (e.g. "Springfield Academy" → `springfield@marksheet.top`). Display name = full `school.name`.
- `from` header format: `"School Name" <firstword@marksheet.top>`.
- `replyTo` = `school.email` when present.
- BYO-SMTP keeps precedence over managed when `smtpEnabled` + host + port + user + password are all set.
- Hard-block `SMTP_NOT_CONFIGURED` only when neither BYO nor managed (`RESEND_API_KEY`) is available.
- Existing `SMTP_*` env (platform mail, no `schoolId`) is unchanged.

---

## File Structure

- Create: `src/lib/email/managed-from.ts` — pure helpers `getManagedFrom`, `getManagedReplyTo` (single source of truth, importable by server + server component).
- Modify: `src/lib/email/send.ts` — add managed branch + `sendViaManaged`; import helpers.
- Modify: `src/lib/email/send.test.ts` — cover managed path, BYO precedence, hard-block.
- Modify: `.env` (runtime secret) + `.env.example` (committed doc) — add `RESEND_API_KEY`, `MANAGED_EMAIL_DOMAIN`, `MANAGED_EMAIL_HOST`, `MANAGED_EMAIL_PORT`.
- Modify: `src/app/console/(main)/schools/[id]/page.tsx` — compute + pass `managedFrom` into the client VM.
- Modify: `src/app/console/(main)/schools/[id]/client.tsx` — relabel BYO card, add managed status line, fix badge.
- Modify: `src/app/console/(main)/schools/[id]/actions.ts` — clarify test-email copy.
- Modify: `src/app/(app)/layout.tsx` — remove the `smtpEnabled` setup-gate banner.

---

### Task 1: Managed sender helpers + resolution in `send.ts`

**Files:**
- Create: `src/lib/email/managed-from.ts`
- Modify: `src/lib/email/send.ts:27-86` (import + `sendEmail` school branch + add `sendViaManaged`)
- Test: `src/lib/email/send.test.ts`

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `MANAGED_EMAIL_DOMAIN`, `MANAGED_EMAIL_HOST`, `MANAGED_EMAIL_PORT`
- Produces: `getManagedFrom(school)`, `getManagedReplyTo(school)` (used by `send.ts` and `page.tsx`); `sendViaManaged` (internal)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/email/send.test.ts` (inside the existing `describe`/imports; keep the existing mocks):

```ts
import { getManagedFrom, getManagedReplyTo } from "./managed-from";

describe("managed sender helpers", () => {
  it("builds a quoted from address from the school name's first word", () => {
    expect(getManagedFrom({ name: "Springfield Academy", shortcode: "SA", id: "s1" }))
      .toBe('"Springfield Academy" <springfield@marksheet.top>');
  });
  it("falls back to shortcode then id when the name is blank", () => {
    expect(getManagedFrom({ name: "", shortcode: "TDC", id: "s2" }))
      .toBe('"" <tdc@marksheet.top>');
    expect(getManagedFrom({ name: "   ", shortcode: null, id: "s3" }))
      .toBe('"" <s3@marksheet.top>');
  });
  it("returns the school email as reply-to when present", () => {
    expect(getManagedReplyTo({ email: "admin@springfield.com" })).toBe("admin@springfield.com");
    expect(getManagedReplyTo({ email: null })).toBeUndefined();
  });
});

describe("managed sender resolution", () => {
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  afterAll(() => { if (ORIGINAL_KEY) process.env.RESEND_API_KEY = ORIGINAL_KEY; });

  it("uses the managed Marksheet domain when RESEND_API_KEY is set and school has no BYO SMTP", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockFindUnique.mockResolvedValueOnce({
      name: "Springfield Academy", email: "admin@springfield.com", shortcode: "SA", id: "school-2",
      smtpEnabled: false, smtpHost: null, smtpPort: null, smtpUser: null, smtpPassEnc: null, smtpFrom: null, smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-2" });

    expect(res.ok).toBe(true);
    const sent = mockSendMail.mock.calls[0][0];
    expect(sent.from).toBe('"Springfield Academy" <springfield@marksheet.top>');
    expect(sent.replyTo).toBe("admin@springfield.com");
  });

  it("still prefers BYO SMTP over managed when both are available", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockFindUnique.mockResolvedValueOnce({
      name: "Springfield Academy", email: "admin@springfield.com", shortcode: "SA", id: "school-3",
      smtpEnabled: true, smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: "school@gmail.com",
      smtpPassEnc: "app-password", smtpFrom: "school@gmail.com", smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-3" });

    expect(res.ok).toBe(true);
    expect(mockSendMail.mock.calls[0][0].from).toBe("school@gmail.com");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/email/send.test.ts`
Expected: FAIL (`Cannot find module "./managed-from"` / `getManagedFrom` undefined).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/email/managed-from.ts`:

```ts
export interface ManagedSchoolSource {
  name: string;
  shortcode?: string | null;
  id: string;
  email?: string | null;
}

export function getManagedFrom(school: ManagedSchoolSource): string {
  const domain = process.env.MANAGED_EMAIL_DOMAIN || "marksheet.top";
  const raw = (school.name || "").trim().split(/\s+/)[0] || school.shortcode || school.id;
  const local = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `"${school.name}" <${local}@${domain}>`;
}

export function getManagedReplyTo(school: ManagedSchoolSource): string | undefined {
  return school.email?.trim() || undefined;
}
```

Modify `src/lib/email/send.ts` — add import at top:

```ts
import { getManagedFrom, getManagedReplyTo } from "./managed-from";
```

Extend the `prisma.school.findUnique` `select` (lines 38-46) to also include `name`, `email`, `shortcode`, `id`:

```ts
    select: {
      name: true,
      email: true,
      shortcode: true,
      id: true,
      smtpEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassEnc: true,
      smtpFrom: true,
      smtpSecure: true,
    },
```

Replace the body of `sendEmail` (after the no-`schoolId` early return) so BYO takes precedence and managed is the fallback:

```ts
  const school = await prisma.school.findUnique({
    where: { id: options.schoolId },
    select: {
      name: true,
      email: true,
      shortcode: true,
      id: true,
      smtpEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassEnc: true,
      smtpFrom: true,
      smtpSecure: true,
    },
  });

  if (!school) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  // 1) BYO-SMTP takes precedence when fully configured.
  if (school.smtpEnabled && school.smtpHost && school.smtpPort && school.smtpUser && school.smtpPassEnc) {
    const port = school.smtpPort;
    const pass = decryptSecret(school.smtpPassEnc);
    const from = school.smtpFrom ?? school.smtpUser;
    try {
      const transporter = nodemailer.createTransport({
        host: school.smtpHost,
        port,
        secure: school.smtpSecure || port === 465,
        auth: { user: school.smtpUser, pass },
      });
      await transporter.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[EMAIL ERROR]", message);
      return { ok: false, error: message };
    }
  }

  // 2) Managed sending via the platform Resend domain.
  if (process.env.RESEND_API_KEY) {
    return sendViaManaged(options, school);
  }

  // 3) Neither available.
  return { ok: false, error: "SMTP_NOT_CONFIGURED" };
```

Add `sendViaManaged` (module-private) after `sendEmail`:

```ts
async function sendViaManaged(
  options: EmailOptions,
  school: { name: string; email?: string | null; shortcode?: string | null; id: string },
): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.MANAGED_EMAIL_HOST || "smtp.resend.com";
  const port = parseInt(process.env.MANAGED_EMAIL_PORT || "587", 10);
  const pass = process.env.RESEND_API_KEY as string;
  const from = getManagedFrom(school);
  const replyTo = getManagedReplyTo(school);
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: "resend", pass },
    });
    await transporter.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html, replyTo });
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EMAIL ERROR]", message);
    return { ok: false, error: message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/email/send.test.ts`
Expected: PASS (existing 6 + new 5 = 11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/managed-from.ts src/lib/email/send.ts src/lib/email/send.test.ts
git commit -m "feat: add managed Resend sender with computed school from-address"
```

---

### Task 2: Environment configuration

**Files:**
- Modify: `.env` (runtime — add secret; not committed)
- Modify: `.env.example` (committed doc)

**Interfaces:**
- Consumes: nothing new in code (Task 1 already reads these vars)
- Produces: `RESEND_API_KEY`, `MANAGED_EMAIL_DOMAIN`, `MANAGED_EMAIL_HOST`, `MANAGED_EMAIL_PORT` available at runtime

- [ ] **Step 1: Add the vars to `.env.example`**

Append to `.env.example` (create it if missing):

```bash
# Managed school email (Resend SMTP) — used when a school has no own SMTP
RESEND_API_KEY=
MANAGED_EMAIL_DOMAIN=marksheet.top
MANAGED_EMAIL_HOST=smtp.resend.com
MANAGED_EMAIL_PORT=587
```

- [ ] **Step 2: Add the real values to `.env`**

In the runtime `.env`, set the actual secret (do NOT commit it):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
MANAGED_EMAIL_DOMAIN=marksheet.top
MANAGED_EMAIL_HOST=smtp.resend.com
MANAGED_EMAIL_PORT=587
```

- [ ] **Step 3: Verify managed path activates**

Run: `RESEND_API_KEY=re_test npx vitest run src/lib/email/send.test.ts`
Expected: PASS — confirms `isManagedEnabled()` reads the var correctly (the managed test in Task 1 already exercises this when the var is set).

- [ ] **Step 4: Commit `.env.example` only**

```bash
git add .env.example
git commit -m "docs: document managed email env vars (Resend)"
```

---

### Task 3: Console UI — managed status + relabel BYO card

**Files:**
- Modify: `src/app/console/(main)/schools/[id]/page.tsx:50-55` (pass `managedFrom`)
- Modify: `src/app/console/(main)/schools/[id]/client.tsx:7-29` (VM interface) and `:270-341` (card)
- Modify: `src/app/console/(main)/schools/[id]/actions.ts:370-395` (test-email copy)
- Test: run `npx tsc --noEmit` + manual UI check

**Interfaces:**
- Consumes: `getManagedFrom` from `@/lib/email/managed-from`
- Produces: `SchoolVM.managedFrom` string shown in the console

- [ ] **Step 1: Compute `managedFrom` in the page and pass it down**

In `page.tsx`, import the helper and add `managedFrom` to the client prop:

```ts
import { getManagedFrom } from "@/lib/email/managed-from";
...
  return (
    <SchoolDetailClient
      school={{
        ...school,
        managedFrom: getManagedFrom(school),
        createdAt: school.createdAt.toISOString(),
      }}
      licenses={...}
      plans={...}
    />
  );
```

- [ ] **Step 2: Add `managedFrom` to the `SchoolVM` interface (client.tsx)**

In the `SchoolVM` interface, add the field:

```ts
  smtpEnabled: boolean;
  managedFrom: string;
```

- [ ] **Step 3: Relabel the BYO card, add the managed status line, fix the badge**

In `client.tsx`, replace the "Email Sender (SMTP)" card header block (lines 270-283) with:

```tsx
        {/* Email Sender */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Email Sender</h2>
            {school.smtpEnabled && school.smtpHost && school.smtpPort && school.smtpUser ? (
              <span className="rounded-full bg-emerald-900/50 text-emerald-300 text-[11px] px-2.5 py-0.5 font-medium border border-emerald-800/30">Using your SMTP</span>
            ) : (
              <span className="rounded-full bg-sky-900/50 text-sky-300 text-[11px] px-2.5 py-0.5 font-medium border border-sky-800/30">Managed by Marksheet</span>
            )}
          </div>
          <p className="text-xs text-white/30 mb-4">
            School emails are sent from <span className="font-mono text-white/70">{school.managedFrom}</span>, managed by Marksheet (no setup needed).
            To send from your own domain instead, configure a Gmail/SMTP account below (use a Gmail <strong>app password</strong>, not the account password).
          </p>
```

The existing `<form action={smtpAction} ...>` block (lines 284-327) stays as-is — it is now the optional "advanced" BYO form. Optionally relabel its submit button copy to "Save your SMTP settings" (no logic change required).

- [ ] **Step 4: Clarify the test-email copy (actions.ts)**

In `sendTestSmtpEmailAction`, update the `SMTP_NOT_CONFIGURED` branch message:

```ts
        result.error === "SMTP_NOT_CONFIGURED"
          ? "Email sending is unavailable: managed sending is off and no SMTP is configured for this school."
          : result.error ?? "Failed to send test email.",
```

- [ ] **Step 5: Type-check and verify**

Run: `npx tsc --noEmit`
Expected: no errors. Visually confirm the console school page shows "Managed by Marksheet" and the `managedFrom` address for a school without BYO SMTP.

- [ ] **Step 6: Commit**

```bash
git add src/app/console/\(main\)/schools/\[id\]/page.tsx src/app/console/\(main\)/schools/\[id\]/client.tsx src/app/console/\(main\)/schools/\[id\]/actions.ts
git commit -m "feat: console UI for managed school email + optional BYO SMTP"
```

---

### Task 4: Remove the SMTP setup-gate banner

**Files:**
- Modify: `src/app/(app)/layout.tsx:76-83` (drop `smtpEnabled` from query) and `:158-165` (remove banner)

**Interfaces:**
- Consumes: nothing (removes a condition)
- Produces: school-facing app no longer shows the "email disabled" banner

- [ ] **Step 1: Drop `smtpEnabled` from the layout's school-info query**

In `layout.tsx`, change the `schoolInfo` select (line 76 + 80) to remove `smtpEnabled` (it is no longer needed for gating):

```ts
  let schoolInfo: { name: string; logo: string | null; motto: string | null; shortcode: string | null; portalTheme: string } | null = null;
  if (user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, logo: true, motto: true, shortcode: true, portalTheme: true },
    });
    schoolInfo = school;
  }
```

- [ ] **Step 2: Remove the banner block**

Delete the "School email setup gate" block (lines 158-165):

```tsx
        {/* School email setup gate */}
        {schoolInfo && !schoolInfo.smtpEnabled && (
          <div className="px-margin-mobile md:px-margin-desktop pt-3">
            <div className="rounded-lg border border-amber-800/40 bg-amber-900/20 px-4 py-2 text-sm text-amber-200">
              Email sending is disabled until the console owner configures your SMTP sender.
            </div>
          </div>
        )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (`smtpEnabled` no longer referenced in layout).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "fix: remove SMTP setup-gate banner (managed email is default)"
```

---

### Task 5: Final verification

**Files:** none new

- [ ] **Step 1: Run the full test suite + type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests green (managed + BYO + crypto + existing).

- [ ] **Step 2: Commit (if any stray fixes)**

Only if Task 5 Step 1 surfaced fixes:

```bash
git add -A
git commit -m "chore: final verification fixes for managed school email"
```
