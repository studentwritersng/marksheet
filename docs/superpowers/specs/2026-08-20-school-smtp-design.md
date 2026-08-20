# Per-School SMTP Sender (School Email Sender)

**Date:** 2026-08-20
**Status:** Approved design
**Author:** Teta / platform owner

## Context

Today all outbound email is sent through a single shared SMTP configuration read
from environment variables (`SMTP_HOST/PORT/USER/PASS/FROM`) in
`src/lib/email/send.ts`. Every school's mail — staff/student credentials,
notifications, announcements, result releases — goes out from the platform
owner's sender.

We want each school to own its own message sender. Per the agreed product
direction:

- Schools are **required** to create a new Gmail account for sending mail.
- The Gmail SMTP credentials are shared with the **console owner**, who
  configures them.
- For now schools send through their own Gmail SMTP.
- Near future: a VPS will provision per-school domain emails, configured from
  the console. The design below is generic SMTP so this is just a config change
  later (no schema rework needed for the Gmail→VPS switch).

## Goals

1. Each school can have its own SMTP sender, configured by the console owner.
2. School-scoped emails use the school's SMTP; if a school has no SMTP
   configured, sending is **hard-blocked** and a setup gate is shown in the
   school UI.
3. Platform-level emails (marketing contact, platform auth/password resets,
   console/owner comms) continue to use the shared env SMTP.
4. SMTP passwords are encrypted at rest (reuse existing AES-256-GCM helper).

## Non-goals

- Not building the VPS domain-email provisioning yet (future phase; schema is
  left generic so it slots in).
- Not letting school admins enter credentials themselves (console owner only).
- Not changing in-app notification delivery (only the email channel).

## Approach (A): per-school fields on `School`

Store the SMTP config as typed, nullable fields on the `School` model. Resolve
the sender at send time by `schoolId`. Chosen over a separate 1:1 model (B) for
simplicity now, and over a JSON column (C) for type-safety. We will evolve to a
separate `SchoolSmtpConfig` model only when the VPS multi-sender phase arrives.

## Data model

New nullable fields on `School` (`prisma/schema.prisma`):

```
smtpHost      String?                       // e.g. smtp.gmail.com
smtpPort      Int?                          // e.g. 587
smtpUser      String?                       // Gmail address
smtpPassEnc   String?                       // encrypted app password (AES-256-GCM)
smtpFrom      String?                       // From address (Gmail: == smtpUser)
smtpSecure    Boolean @default(false)       // true => port 465 SSL; false => STARTTLS
smtpEnabled   Boolean @default(false)       // master on/off + "configured" flag
```

New migration. Existing schools default to `smtpEnabled = false` → blocked
(until the console owner configures them), matching the "compulsory" requirement.

## Crypto

Reuse `encryptSecret` / `decryptSecret` from `src/lib/secrets.ts`
(AES-256-GCM, key from `ENCRYPTION_KEY`/`AUTH_SECRET`). The app password is
encrypted before being written and decrypted only when building the nodemailer
transport.

## `sendEmail` resolution

`src/lib/email/send.ts` — new signature:

```ts
interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  schoolId?: string;        // when present, resolve school SMTP
}
```

Logic:

1. `schoolId` present **and** `smtpEnabled` is true **and** host/port/user/pass
   present → build transporter from the school's **decrypted** creds.
   `secure = smtpSecure || port === 465`. `from = smtpFrom ?? smtpUser`.
2. `schoolId` present but not configured (`smtpEnabled` false or missing creds)
   → return `{ ok: false, error: "SMTP_NOT_CONFIGURED" }`. **No env fallback
   for school mail** (hard block + setup gate).
3. No `schoolId` (platform mail) → use env SMTP exactly as today.

The dev fallback (log to console when no host/port) still applies to the env
path only.

## Caller updates

| Caller | schoolId? | Behaviour |
| --- | --- | --- |
| `staff/actions.ts` (credential email) | yes | school SMTP; blocked if not configured |
| `students/actions.ts` (login email) | yes | school SMTP; blocked if not configured |
| `students/csv-actions.ts` (bulk emails) | yes | school SMTP; blocked if not configured |
| `notifications/actions.ts` (email channel) | yes | school SMTP; blocked if not configured |
| announcement / result-release emails | yes | school SMTP; blocked if not configured |
| `marketing/actions.ts` (contact form) | no | shared env SMTP |
| platform password resets / console comms | no | shared env SMTP |

Each school-scoped caller passes the `schoolId` it already has in context.

## Console UI (console owner configures)

In `console/(main)/schools/[id]` (page + client) add an **"Email Sender (SMTP)"**
card:

- Host (default `smtp.gmail.com`), Port (default `587`)
- User (Gmail address), App-password (masked), From name/address
- Secure toggle (SSL/TLS), Enabled toggle
- Save (encrypts the password before write via a server action)
- "Send test email" button (sends to a console-owner-supplied address)
- Status badge: Configured / Not configured

This satisfies "shared with the console owner" — the owner is the one entering
and can see/manage the credentials.

## School setup gate

When `school.smtpEnabled === false`, a non-dismissable banner is shown in the
school app (in `(app)/layout.tsx` or the school settings page):

> "Email sending is disabled until the console owner configures your SMTP
> sender."

This gates the UI so school users cannot trigger school mail sends until the
console owner sets SMTP up.

## Gmail specifics

- Target Gmail SMTP: `smtp.gmail.com`, STARTTLS on `587` (or SSL `465`).
- Stored password is a Gmail **app password**, not the account password.
- Gmail requires `From` to equal the authenticated account, so `smtpFrom` /
  `smtpUser` should be the school's Gmail; display name = school name.
- A clear hint in the console form explains "use a Gmail app password".

## Migration & backward compatibility

- New columns are nullable; no data migration needed.
- Existing schools: `smtpEnabled = false` → their mail is blocked and they see
  the setup gate until configured. This is the intended compulsory behaviour.
- Platform mail (no `schoolId`) is unchanged.

## Testing

- **`sendEmail` resolution unit test** (mock `nodemailer.createTransport`):
  - school config present → school transporter used with decrypted creds.
  - school config missing/disabled → returns `{ ok: false, error: "SMTP_NOT_CONFIGURED" }`.
  - no `schoolId` → env path used.
- **Crypto roundtrip test**: `decryptSecret(encryptSecret(pwd)) === pwd`.

## Future (out of scope)

When the VPS domain-email phase lands, evolve to a `SchoolSmtpConfig` 1:1 model
with provisioning status and per-domain senders, configured from the console.
The generic host/port/user/pass shape means the Gmail→VPS switch is config-only.
