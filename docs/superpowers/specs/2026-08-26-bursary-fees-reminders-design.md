# Bursary (Fees) & Fee Reminders — Design Spec

- **Date:** 2026-08-26
- **Status:** Approved (design), pending implementation plan
- **Scope:** Feature 1 (Bursary core + fee menu + payments) and Feature 2 (fee reminders) of a larger request that also includes a student-homework "assignment" feature (tracked separately).
- **Related:** extends the existing `FeeStatus` model / exam-result fee gating. Reuses existing notification infrastructure (`createNotification`, `deliverPushForNotification`, `sendEmail`, `queueEventNotification`).

## 1. Context & Goals

Today the platform has **no school-fee amounts**. `FeeStatus` is only a manual `cleared / not_cleared / partial` flag per student per term, and the fee-status page states it *"contains no financial figures."* There is no tuition per class, no custom fees, no payment history, and no way to tell a parent how much is owed.

This feature adds a real bursary system:

1. **Fee menu** — define tuition and other named fees per class level per term.
2. **Payment ledger** — record individual dated payments; auto-compute each student's *expected / paid / balance / status*.
3. **Fee status** — derived automatically (no manual flag needed once amounts exist).
4. **Fee reminders** — one-click bulk send **and** optional weekly scheduled send of push + email to parents, showing expected/paid/balance per ward.

Out of scope (deferred to separate specs): student homework/assignment feature; invoicing/receipt numbering; refunds; SMS/WhatsApp fee reminders (the event label `fee_reminder` exists and could be wired later via `queueEventNotification`, but this spec covers in-app/push/email only).

## 2. Key Decisions (from Q&A)

- **Tuition = per class level per term.** Each `Class.level` (e.g. `JSS1`) has fee items for the chosen term.
- **Custom fees = named fee items scoped to selected levels** (e.g. "PTA Levy" applies to JSS1+JSS2).
- **Payments = individual dated records** (amount, method, note, recorder) → paid = Σ.
- **Status auto-computed** from expected vs paid.
- **Reminders fire both ways**: one-click bulk send from the bursar, plus optional weekly schedule (cron).
- **Recipients = all guardians** of an owing student who have an email / app account.
- **Approach A (chosen)**: fee items + payment ledger, status computed live via a helper; legacy `FeeStatus` kept only as a fallback.

## 3. Data Model (Prisma)

```prisma
// One charge per class-level per term — the "fee menu".
model FeeItem {
  id        String   @id @default(cuid())
  schoolId  String
  termId    String
  level     String              // "JSS1" … — matches Class.level
  name      String              // "Tuition", "PTA Levy", …
  amount    Decimal             // NGN (whole naira)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  term   Term   @relation(fields: [termId], references: [id], onDelete: Cascade)
  @@unique([termId, level, name])
  @@index([schoolId, termId])
  @@map("fee_items")
}

// Individual dated payment records — the ledger.
model StudentPayment {
  id         String   @id @default(cuid())
  schoolId   String
  studentId  String
  termId     String
  amount     Decimal
  method     String   @default("cash")   // cash | transfer | pos | online
  note       String?
  recordedBy String?                     // staff userId
  createdAt  DateTime @default(now())
  school  School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  term    Term    @relation(fields: [termId], references: [id], onDelete: Cascade)
  @@index([studentId, termId])
  @@index([schoolId, termId])
  @@map("student_payments")
}

// Reminder schedule (Feature 2, created with this migration).
model FeeReminderConfig {
  id            String    @id @default(cuid())
  schoolId      String    @unique
  weeklyEnabled Boolean   @default(false)
  dayOfWeek     Int       @default(1)      // 0=Sun … 6=Sat
  lastSentAt    DateTime?
  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  @@map("fee_reminder_configs")
}
```

**Enum change:** add `bursar` to `AssignmentType` (migration `ALTER TYPE … ADD VALUE`). `fee_status_manager` remains and keeps working.

**Legacy `FeeStatus`:** unchanged. Used only as fallback (§4).

## 4. Computation & Gates — Single Source of Truth

New module `src/lib/fees/bursary.ts`:

```ts
export interface StudentFeeSummary {
  expected: number;   // naira; 0 if no fee items for this level/term
  paid: number;
  balance: number;    // max(0, expected - paid)
  status: "cleared" | "partial" | "not_paid" | "no_structure";
  overpaid: number;   // max(0, paid - expected)
}

export function deriveFeeStatus(expected: number, paid: number): StudentFeeSummary["status"];
export async function getStudentFeeSummary(studentId: string, termId: string): Promise<StudentFeeSummary>;
export async function getStudentFeeSummaryBatch(schoolId: string, termId: string): Promise<Map<string, StudentFeeSummary>>;
```

Rules:
- `expected` = Σ `FeeItem.amount` where `termId` matches **and** `level = student.currentClass.level`. `0` if none defined.
- `paid` = Σ `StudentPayment.amount` for that student + term.
- `balance = max(0, expected − paid)`; `overpaid = max(0, paid − expected)`.
- `status`:
  - no items defined → `no_structure`
  - `expected > 0 && paid >= expected` → `cleared`
  - `0 < paid < expected` → `partial`
  - `paid == 0` → `not_paid`
- **Migration safety:** when `status === "no_structure"`, `src/lib/fees/gate.ts` (`checkExamFeeGate`, `isResultVisibleByFeeGate`, `getStudentFeeStatus`) and the existing `/fee-status` page fall back to the legacy `FeeStatus` flag exactly as today. Schools with no fee items see **zero behaviour change**. Once any fee item exists for a term, that term switches to computed amounts automatically.

## 5. Permissions

- `resolvePermissions` gains `isBursar` (from `AssignmentType.bursar` assignment) and a shared helper `canManageFees(user)` = `isSchoolAdmin || isFeeStatusManager || isBursar`.
- New actions/pages use `canManageFees()`. `isFeeStatusManager` checks are left as-is (still grant fee management).
- Nav gains a **Bursary** group (Fee Menu · Payments · Reminders) visible to `canManageFees()` roles. Students see their own amounts on the existing fee-status page; parents get an owing card per ward (§6).

## 6. UI Pages

All under the Bursary nav group; follow existing patterns (`useActionState`-style `{error?, success?}`, `recordAudit`, `guardActiveLicense`, scoped Prisma queries).

- **`/fees` — Fee Menu**: term selector; fee items grouped by level with per-level totals; create/edit/delete item (name, amount, level). **"Copy from previous term"** clones the last term's items into the selected term (one-click term setup).
- **`/fees/payments` — Payments**: pick term + class → roster table: student · admission no · expected · paid · balance · status badge. Row actions: **Record payment** (amount, method, note) and **History** (list of that student's payments for the term; delete allowed with confirm + audit). Bulk-select rows → "Record same payment" for many students at once.
- **`/fees/reminders` — Reminders**: preview list per student (ward name · class · expected/paid/balance · guardian count, flagging guardians missing email/app account); filters: class, "only owing" toggle. **Send now** button + weekly schedule card (enabled toggle, day-of-week picker, "last sent" timestamp).
- **Existing `/fee-status`**: mechanics untouched; when a structure exists it shows computed amounts instead of manual flags; students see their own expected/paid/balance.
- **Parent dashboard**: per-ward owing card (ward name, class, expected, paid, balance, status).

## 7. Reminder Flow

- **Recipients:** all guardians (`Guardian.parentUserId` and/or `.email`) of students with `balance > 0` (optionally filtered by class / owing-only).
- **Grouping:** a parent with multiple wards receives **one** message listing each ward's numbers: `"Ada (JSS1A): Total ₦50,000 · Paid ₦20,000 · Balance ₦30,000"`.
- **Delivery per guardian:**
  - registered app account → `createNotification({ recipientType: "parent", recipientId: guardian.parentUserId, channel: "in_app", eventType: "fee_reminder", … })` → push fires automatically via `deliverPushForNotification`.
  - email on file → `createNotification({ channel: "email", recipientEmail: guardian.email, … })` → `sendEmail` (school SMTP → Resend fallback).
  - Failures counted; result toast: *"Sent 42 push / 38 email · 4 failed (no SMTP)"*.
- **Scheduled:** new route `/api/cron/fee-reminders`, guarded by `CRON_SECRET` (mirrors the existing `/api/notifications/process-queue` cron pattern). Runs schools where `weeklyEnabled`, skips if `lastSentAt` within 6 days, updates `lastSentAt`. Host scheduler pointed at the URL once.
- Every send audited (`recordAudit("fee_reminders_sent", { sent, failed, schoolId })`).

## 8. Edge Cases, Money & Testing

- **Overpayment:** balance shows ₦0 plus "+₦5,000 credit" note; status stays cleared.
- **Edit/delete fee item after payments exist:** allowed with confirm; totals recompute instantly; audited.
- **Term isolation:** items and payments keyed by `termId`; cross-term never mixed.
- **Money:** Prisma `Decimal` storage; convert to `number` only at render/action edges (matches billing pages). Add shared `formatNaira()` helper in `src/lib/format.ts` (replaces duplicated ad-hoc formatters).
- **Status derivation** extracted as a pure function → unit-tested (`deriveFeeStatus(expected, paid)`) plus tests for reminder message grouping (multiple wards → single grouped text).
- Server actions return `{error?, success?}` state per existing convention.

## 9. Build Order (suggested)

1. Prisma migration (FeeItem, StudentPayment, FeeReminderConfig, `bursar` enum) + `prisma generate`.
2. `src/lib/fees/bursary.ts` + `deriveFeeStatus` unit tests.
3. Wire `gate.ts` to use computed summary with `no_structure` fallback.
4. Permissions (`resolvePermissions`, `canManageFees`, nav).
5. `/fees` menu + copy-previous-term action.
6. `/fees/payments` roster + record/history actions.
7. `/fee-status` + parent dashboard amounts.
8. `/fees/reminders` send-now + weekly config.
9. `/api/cron/fee-reminders` route + audit.
10. Manual + automated verification (see implementation plan).
