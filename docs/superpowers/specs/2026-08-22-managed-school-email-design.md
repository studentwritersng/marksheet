# Managed School Email (marksheet.top via Resend)

**Date:** 2026-08-22
**Status:** Approved (design)
**Depends on:** Per-School SMTP Sender spec (`2026-08-20-school-smtp-design.md`), whose DB migration (`prisma/migrations/20260821000000_add_school_smtp`) is applied to `neondb` (table `schools`).

## Goal

Schools send email from a unique, branded address on the platform-owned domain `marksheet.top`
(verified on Resend), with **zero setup** for the school. A school may optionally override this with
its own Gmail / SMTP (BYO), which remains an advanced setting. Recipients see the school's display
name; replies go to the school's own email.

## Decisions (from clarifying questions)

1. **Per-school sender address** = first word of `school.name`, lowercased, sanitized, + `@marksheet.top`.
   Example: "Springfield Academy" → `springfield@marksheet.top`. Display name = full `school.name`.
   Computed at send time (no stored slug field). Collisions are acceptable — Resend allows any local
   part on the verified domain, and the display name still distinguishes schools.
2. **Managed sending is auto-on** for every school at creation. BYO Gmail/own-domain is optional.
   The hard SMTP setup-gate banner is removed.
3. **Reply-To** = `school.email` (the school's real address) when present, so parents reply to the school.

## Architecture

### 1. Sending resolution — `src/lib/email/send.ts`

Priority when `schoolId` is set:

1. **BYO-SMTP configured** (`smtpEnabled` + `smtpHost` + `smtpPort` + `smtpUser` + `smtpPassEnc`)
   → use the school's own SMTP, `from = smtpFrom ?? smtpUser` (unchanged behavior).
2. **Managed enabled** (`RESEND_API_KEY` present) → Resend managed transport:
   - `from = "School Name" <firstword@marksheet.top>`
   - `replyTo = school.email` (if set)
   - transport = `smtp.resend.com:587` (STARTTLS), `auth.user = "resend"`, `auth.pass = RESEND_API_KEY`
3. **Neither** → hard-block `{ ok: false, error: "SMTP_NOT_CONFIGURED" }` (unchanged).

No `schoolId` (platform mail) → existing `sendViaEnv` (shared `SMTP_*` env) unchanged.

Helper `getManagedFrom(school): string`:
- take `school.name.split(/\s+/)[0]`
- lowercase, strip characters outside `[a-z0-9]` → `local`
- if empty, fall back to `school.shortcode`, then `school.id`
- return `"${school.name}" <${local}@${MANAGED_EMAIL_DOMAIN}>`

Reply-To helper returns `school.email` when non-empty.

### 2. Configuration (env only — no DB migration)

Add to platform env / `.env`:
- `RESEND_API_KEY` — Resend API key (secret)
- `MANAGED_EMAIL_DOMAIN` — default `marksheet.top`
- `MANAGED_EMAIL_HOST` — default `smtp.resend.com`
- `MANAGED_EMAIL_PORT` — default `587`

Existing `SMTP_*` env stays for the no-school (platform) path.

Rationale: no new DB column avoids another migration against Neon (the pooler DDL pitfall already
hit once). The managed `from` is derived from existing `school.name`.

### 3. Data model

No schema change. `smtpFrom` remains BYO-only. `school.name`, `school.shortcode`, `school.email`,
`school.id` already exist and power the computed managed address.

### 4. UI — console school settings (`src/app/console/(main)/schools/[id]/`)

- The existing BYO SMTP card stays, relabeled **"Use your own email (advanced)"**.
- Add a status line: *"Emails are sent from 'School Name' <firstword@marksheet.top>, managed by Marksheet."*
- Keep `updateSchoolSmtpAction` / `sendTestSmtpEmailAction` for the BYO path.
- Add a "Send test email" action for the managed path (sends via Resend transport to verify deliverability
  and shows the resulting `from`).

### 5. Setup-gate banner — `src/app/(app)/layout.tsx`

Remove the `smtpEnabled` blocking condition from the school setup gate. Managed sending covers every
school by default, so the banner must not nag about email configuration. Keep the gate only for any
other required, genuinely-unfinished setup; otherwise drop the SMTP portion.

### 6. New & existing schools

- **New schools:** managed works immediately — nothing to configure.
- **Existing schools:** gain managed sending automatically (computed `from`); any school already on
  BYO (`smtpEnabled = true`) keeps BYO precedence. No backfill migration needed.

## Error handling

- Managed send failure (Resend auth/network) → catch, `console.error`, return `{ ok: false, error }`
  (same pattern as today).
- `RESEND_API_KEY` missing and school not BYO-configured → `SMTP_NOT_CONFIGURED` (school mail never
  silently falls back to the platform sender).

## Testing

Extend `src/lib/email/send.test.ts`:
- Managed path builds correct `from` (`"Name" <firstword@marksheet.top>`) and `replyTo = school.email`
  and uses the Resend transport when `RESEND_API_KEY` is set and school is not BYO-configured.
- BYO path still takes precedence when configured.
- Hard-block when no `RESEND_API_KEY` and not BYO-configured.
- Mock `nodemailer.createTransport` so no network call is made.
- `tsc --noEmit` clean; existing 6 tests stay green.

## Out of scope (YAGNI)

- Subdomain isolation (`schools.marksheet.top`) — root domain is verified and sufficient.
- Resend SDK / tags / scheduling.
- Inbound email handling for `marksheet.top` (replies go to `school.email`).
- Per-school stored slug field.
