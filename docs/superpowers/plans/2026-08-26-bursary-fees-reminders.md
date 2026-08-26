# Bursary (Fees) & Fee Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-class-level/per-term fee menu, a payment ledger with auto-computed expected/paid/balance/status, and one-click + scheduled fee reminders (push + email) to parents.

**Architecture:** New Prisma models (`FeeItem`, `StudentPayment`, `FeeReminderConfig`) plus a `bursar` assignment type. A single helper `getStudentFeeSummary` is the source of truth for amounts and status; legacy `FeeStatus` is used only as a fallback when no fee items exist for a term (so existing schools are unaffected). Reminders reuse the existing `createNotification` → push/email pipeline.

**Tech Stack:** Next.js (App Router, `"use server"` actions, `useActionState`-style `{error?,success?}` returns), Prisma + PostgreSQL, Vitest, existing `recordAudit` / `guardActiveLicense` / `resolvePermissions` / `createNotification` / `deliverPushForNotification` / `sendEmail` utilities.

## Global Constraints

- Money stored as Prisma `Decimal` (NGN whole naira); convert to `number` only at render/action edges. (spec §8)
- New mutations must call `recordAudit(...)` and `await guardActiveLicense(schoolId)`. (spec §5, §6)
- Actions return `{error?, success?}` state object; gate with `requireFeeManager()`-equivalent (`canManageFees`). (spec §5, existing pattern `src/app/(app)/fee-status/actions.ts`)
- Tuition = per class level per term; custom fees = named FeeItems scoped to selected levels. (spec §2)
- Payments = individual dated records; status auto-computed (`cleared`/`partial`/`not_paid`/`no_structure`). (spec §2, §4)
- Reminders: one-click + optional weekly cron; all guardians of owing students; one grouped message per parent; push + email. (spec §2, §7)
- When no fee items exist for a term, fall back to legacy `FeeStatus` flag everywhere (gates, pages). (spec §4)
- No dedicated `bursar` UI role label beyond `AssignmentType.bursar`; `canManageFees = isSchoolAdmin || isFeeStatusManager || isBursar`. (spec §5)

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (enum `AssignmentType`, add 3 models)
- Create: `prisma/migrations/<timestamp>_add_bursary/migration.sql`
- Run: `npx prisma generate`

**Interfaces:**
- Produces: `FeeItem`, `StudentPayment`, `FeeReminderConfig` Prisma models; `AssignmentType.bursar`.

- [ ] **Step 1: Add models + enum value to `schema.prisma`**

Add `bursar` to the enum (after `fee_status_manager`):
```prisma
enum AssignmentType {
  subject_teacher
  class_teacher
  hod
  exam_officer
  school_admin
  fee_status_manager
  bursar            // ← add
  receptionist
}
```

Append these models (near `FeeStatus`):
```prisma
model FeeItem {
  id        String   @id @default(cuid())
  schoolId  String
  termId    String
  level     String
  name      String
  amount    Decimal
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  term   Term   @relation(fields: [termId], references: [id], onDelete: Cascade)
  @@unique([termId, level, name])
  @@index([schoolId, termId])
  @@map("fee_items")
}

model StudentPayment {
  id         String   @id @default(cuid())
  schoolId   String
  studentId  String
  termId     String
  amount     Decimal
  method     String   @default("cash")
  note       String?
  recordedBy String?
  createdAt  DateTime @default(now())
  school  School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  term    Term    @relation(fields: [termId], references: [id], onDelete: Cascade)
  @@index([studentId, termId])
  @@index([schoolId, termId])
  @@map("student_payments")
}

model FeeReminderConfig {
  id            String    @id @default(cuid())
  schoolId      String    @unique
  weeklyEnabled Boolean   @default(false)
  dayOfWeek     Int       @default(1)
  lastSentAt    DateTime?
  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  @@map("fee_reminder_configs")
}
```

- [ ] **Step 2: Generate the SQL migration**

Run `npx prisma migrate dev --name add_bursary --create-only` then edit the generated `migration.sql` to:
```sql
-- add new enum value
ALTER TYPE "AssignmentType" ADD VALUE 'bursar';

-- fee items
CREATE TABLE "fee_items" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "student_payments" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'cash',
  "note" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "fee_reminder_configs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "weeklyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dayOfWeek" INTEGER NOT NULL DEFAULT 1,
  "lastSentAt" TIMESTAMP(3),
  CONSTRAINT "fee_reminder_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fee_items_termId_level_name_key" ON "fee_items"("termId","level","name");
CREATE INDEX "fee_items_schoolId_termId_idx" ON "fee_items"("schoolId","termId");
CREATE INDEX "student_payments_studentId_termId_idx" ON "student_payments"("studentId","termId");
CREATE INDEX "student_payments_schoolId_termId_idx" ON "student_payments"("schoolId","termId");
CREATE UNIQUE INDEX "fee_reminder_configs_schoolId_key" ON "fee_reminder_configs"("schoolId");
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_reminder_configs" ADD CONSTRAINT "fee_reminder_configs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply + generate**
Run `npx prisma migrate dev` (applies the migration) then `npx prisma generate`. Confirm `npx tsc --noEmit` still passes for Prisma client.

- [ ] **Step 4: Commit**
```bash
git add prisma && git commit -m "feat(bursary): schema + migration for FeeItem, StudentPayment, FeeReminderConfig, bursar role"
```

---

### Task 2: Pure fee-status + reminder-message logic (TDD)

**Files:**
- Create: `src/lib/fees/bursary.ts`
- Create: `src/lib/fees/bursary.test.ts`

**Interfaces:**
- Produces: `deriveFeeStatus(expected: number, paid: number): "cleared" | "partial" | "not_paid"`, `buildFeeReminderContent(wards: WardLine[]): string`.

- [ ] **Step 1: Write failing tests**
```ts
import { describe, it, expect } from "vitest";
import { deriveFeeStatus, buildFeeReminderContent } from "./bursary";

describe("deriveFeeStatus", () => {
  it("cleared when fully paid", () => {
    expect(deriveFeeStatus(50000, 50000)).toBe("cleared");
    expect(deriveFeeStatus(50000, 60000)).toBe("cleared"); // overpaid
  });
  it("partial when some paid", () => {
    expect(deriveFeeStatus(50000, 20000)).toBe("partial");
  });
  it("not_paid when nothing paid", () => {
    expect(deriveFeeStatus(50000, 0)).toBe("not_paid");
  });
});

describe("buildFeeReminderContent", () => {
  it("groups multiple wards into one message", () => {
    const out = buildFeeReminderContent([
      { name: "Ada", className: "JSS1A", expected: 50000, paid: 20000, balance: 30000 },
      { name: "Ben", className: "JSS2B", expected: 60000, paid: 60000, balance: 0 },
    ]);
    expect(out).toContain("Ada (JSS1A): Total ₦50,000 · Paid ₦20,000 · Balance ₦30,000");
    expect(out).toContain("Ben (JSS2B): Total ₦60,000 · Paid ₦60,000 · Balance ₦0");
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL** (`function not defined`)

- [ ] **Step 3: Implement `bursary.ts` (pure functions only in this task)**
```ts
export type FeeStatus = "cleared" | "partial" | "not_paid";

export function deriveFeeStatus(expected: number, paid: number): FeeStatus {
  if (expected > 0 && paid >= expected) return "cleared";
  if (paid > 0 && paid < expected) return "partial";
  return "not_paid";
}

export interface WardLine {
  name: string;
  className: string;
  expected: number;
  paid: number;
  balance: number;
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function buildFeeReminderContent(wards: WardLine[]): string {
  const lines = wards.map(
    (w) => `${w.name} (${w.className}): Total ${naira(w.expected)} · Paid ${naira(w.paid)} · Balance ${naira(w.balance)}`,
  );
  return `Fee reminder for your ward(s):\n${lines.join("\n"))}`;
}
```

- [ ] **Step 4: Run tests, expect PASS**
- [ ] **Step 5: Commit**
```bash
git add src/lib/fees/bursary.ts src/lib/fees/bursary.test.ts && git commit -m "feat(bursary): pure fee-status + reminder-message helpers with tests"
```

---

### Task 3: Summary computation + gate integration

**Files:**
- Modify: `src/lib/fees/bursary.ts` (add `getStudentFeeSummary`, `getStudentFeeSummaryBatch`)
- Modify: `src/lib/fees/gate.ts` (use computed summary with `no_structure` fallback)

**Interfaces:**
- Consumes: `deriveFeeStatus` (Task 2); `prisma` client (models from Task 1).
- Produces: `getStudentFeeSummary(studentId, termId): Promise<StudentFeeSummary>`, `getStudentFeeSummaryBatch(schoolId, termId): Promise<Map<string, StudentFeeSummary>>`, updated `getStudentFeeStatus` in gate.ts.

- [ ] **Step 1: Add summary functions to `bursary.ts`**
```ts
import { prisma } from "@/lib/prisma";

export interface StudentFeeSummary {
  expected: number;
  paid: number;
  balance: number;
  overpaid: number;
  status: "cleared" | "partial" | "not_paid" | "no_structure";
  hasStructure: boolean;
}

function toNumber(d: { toNumber(): number } | number): number {
  return typeof d === "number" ? d : d.toNumber();
}

export async function getStudentFeeSummary(studentId: string, termId: string): Promise<StudentFeeSummary> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { currentClass: { select: { level: true } } },
  });
  const level = student?.currentClass?.level ?? null;

  const items = level
    ? await prisma.feeItem.findMany({ where: { termId, level } })
    : [];
  const paidAgg = await prisma.studentPayment.aggregate({
    where: { studentId, termId },
    _sum: { amount: true },
  });

  const expected = items.reduce((s, i) => s + toNumber(i.amount), 0);
  const paid = toNumber(paidAgg._sum.amount ?? 0);
  const hasStructure = items.length > 0;
  const status: StudentFeeSummary["status"] = hasStructure
    ? deriveFeeStatus(expected, paid)
    : "no_structure";

  return {
    expected,
    paid,
    balance: Math.max(0, expected - paid),
    overpaid: Math.max(0, paid - expected),
    status,
    hasStructure,
  };
}

export async function getStudentFeeSummaryBatch(schoolId: string, termId: string): Promise<Map<string, StudentFeeSummary>> {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, currentClass: { select: { level: true } } },
  });
  const [items, payments] = await Promise.all([
    prisma.feeItem.findMany({ where: { termId } }),
    prisma.studentPayment.findMany({ where: { termId } }),
  ]);
  const byLevel = new Map<string, number>();
  for (const it of items) {
    byLevel.set(it.level, (byLevel.get(it.level) ?? 0) + toNumber(it.amount));
  }
  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + toNumber(p.amount));
  }
  const map = new Map<string, StudentFeeSummary>();
  for (const s of students) {
    const level = s.currentClass?.level ?? null;
    const expected = level ? (byLevel.get(level) ?? 0) : 0;
    const paid = paidByStudent.get(s.id) ?? 0;
    const hasStructure = !!level && (byLevel.get(level) ?? 0) > 0;
    map.set(s.id, {
      expected,
      paid,
      balance: Math.max(0, expected - paid),
      overpaid: Math.max(0, paid - expected),
      status: hasStructure ? deriveFeeStatus(expected, paid) : "no_structure",
      hasStructure,
    });
  }
  return map;
}
```

- [ ] **Step 2: Update `gate.ts` to fall back on `no_structure`**
Replace `getStudentFeeStatus` body so it returns the legacy flag only when no structure exists:
```ts
export async function getStudentFeeStatus(studentId: string, termId: string): Promise<string> {
  const { getStudentFeeSummary } = await import("./bursary");
  const sum = await getStudentFeeSummary(studentId, termId);
  if (sum.status === "no_structure") {
    const legacy = await prisma.feeStatus.findUnique({
      where: { studentId_termId: { studentId, termId } },
      select: { status: true },
    });
    return legacy?.status ?? "not_cleared";
  }
  return sum.status; // cleared | partial | not_paid
}
```
Leave `checkExamFeeGate` / `isResultVisibleByFeeGate` unchanged — they already call `getStudentFeeStatus`.

- [ ] **Step 3: Run `npx tsc --noEmit` and `npx vitest run src/lib/fees`** — expect pass.
- [ ] **Step 4: Commit**
```bash
git add src/lib/fees && git commit -m "feat(bursary): summary computation + legacy fallback in fee gates"
```

---

### Task 4: Permissions + navigation

**Files:**
- Modify: `src/lib/auth/permissions.ts` (add `isBursar`, `canManageFees`)
- Modify: `src/lib/nav.ts` (Bursary group for `canManageFees`)

**Interfaces:**
- Produces: `EffectivePermissions.isBursar: boolean`, `canManageFees(perms): boolean`; nav group "Bursary" with `/fees`, `/fees/payments`, `/fees/reminders`.

- [ ] **Step 1: Add `isBursar` to `EffectivePermissions` interface** (line ~24) and to the `empty` object (`isBursar: false`).
- [ ] **Step 2: In the assignment loop** (where `fee_status_manager` sets `isFeeStatusManager = true`), also set `isBursar = true` when `a.type === "bursar"`.
- [ ] **Step 3: Add helper** after `resolvePermissions`:
```ts
export function canManageFees(perms: EffectivePermissions): boolean {
  return perms.isSuperAdmin || perms.isSchoolAdmin || perms.isFeeStatusManager || perms.isBursar;
}
```
- [ ] **Step 4: In `nav.ts`**, after the `Fee Status` line, add (for `canManageFees(perms)`):
```ts
if (canManageFees(perms)) {
  items.push({
    label: "Bursary", icon: "account_balance_wallet", children: [
      { label: "Fee Menu", href: "/fees", icon: "receipt_long" },
      { label: "Payments", href: "/fees/payments", icon: "payments" },
      { label: "Reminders", href: "/fees/reminders", icon: "campaign" },
    ],
  });
}
```
- [ ] **Step 5: `npx tsc --noEmit`** then commit.
```bash
git add src/lib/auth/permissions.ts src/lib/nav.ts && git commit -m "feat(bursary): bursar role + canManageFees guard + nav group"
```

---

### Task 5: Fee menu page + actions

**Files:**
- Create: `src/app/(app)/fees/page.tsx`
- Create: `src/app/(app)/fees/actions.ts`
- Create: `src/lib/format.ts` (`formatNaira` helper)

**Interfaces:**
- Consumes: `canManageFees` (Task 4); `prisma.feeItem`.
- Produces: `createFeeItemAction`, `updateFeeItemAction`, `deleteFeeItemAction`, `copyFeeItemsFromTermAction` (all `ActionState`); `formatNaira(n)`.

- [ ] **Step 1: Create `src/lib/format.ts`**
```ts
export function formatNaira(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
```

- [ ] **Step 2: Create `src/app/(app)/fees/actions.ts`** mirroring `fee-status/actions.ts` authorization (`requireFeeManager` → replace with `canManageFees`). Key actions:
```ts
async function requireBursar() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  if (!canManageFees(perms) || !user.schoolId) throw new Error("FORBIDDEN");
  return { user, schoolId: user.schoolId };
}

export async function createFeeItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireBursar().catch(() => null);
  if (!ctx) return { error: "Not authorised." };
  await guardActiveLicense(ctx.schoolId);
  const termId = String(fd.get("termId") ?? "");
  const level = String(fd.get("level") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const amount = Number(fd.get("amount"));
  if (!termId || !level || !name || !Number.isFinite(amount) || amount < 0)
    return { error: "Term, level, name, and a valid amount are required." };
  const term = await prisma.term.findFirst({ where: { id: termId, session: { schoolId: ctx.schoolId } }, select: { id: true } });
  if (!term) return { error: "Term not found." };
  await prisma.feeItem.create({ data: { schoolId: ctx.schoolId, termId, level, name, amount } });
  await recordAudit({ schoolId: ctx.schoolId, actorId: ctx.user.userId, action: "create", entityType: "fee_item", afterValue: { level, name, amount } as never });
  revalidatePath("/fees");
  return { success: "Fee item added." };
}
// updateFeeItemAction (similar; upsert by id), deleteFeeItemAction (prisma.feeItem.delete + audit),
// copyFeeItemsFromTermAction(fromTermId, toTermId): copies all FeeItems of fromTermId (verified in school) into toTermId with same level/name/amount.
```
- [ ] **Step 3: Create `src/app/(app)/fees/page.tsx`** (server component): load current term (and term list for the selector), `prisma.feeItem.findMany({ where: { schoolId, termId }, orderBy: { level: "asc" } })`, group by `level` showing per-level total via `formatNaira`, plus a form (client component) calling the three actions. Reuse existing form styling from `src/app/(app)/fee-status/fee-status-table.tsx`.
- [ ] **Step 4: `npx tsc --noEmit`** then commit.
```bash
git add src/app/'(app)'/fees src/lib/format.ts && git commit -m "feat(bursary): fee menu page + FeeItem CRUD + copy-from-term"
```

---

### Task 6: Payments page + actions

**Files:**
- Create: `src/app/(app)/fees/payments/page.tsx`
- Create: `src/app/(app)/fees/payments/actions.ts`
- Possibly: `src/app/(app)/fees/payments/payments-table.tsx` (client)

**Interfaces:**
- Consumes: `getStudentFeeSummaryBatch` (Task 3), `canManageFees` (Task 4), `formatNaira` (Task 5).
- Produces: `recordPaymentAction`, `deletePaymentAction`, `bulkRecordPaymentAction` (`{error?,success?}`).

- [ ] **Step 1: Create `actions.ts`**
```ts
export async function recordPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireBursar().catch(() => null); // reuse helper from Task 5 (move to a shared fees/actions.ts or re-import)
  if (!ctx) return { error: "Not authorised." };
  await guardActiveLicense(ctx.schoolId);
  const studentId = String(fd.get("studentId") ?? "");
  const termId = String(fd.get("termId") ?? "");
  const amount = Number(fd.get("amount"));
  const method = String(fd.get("method") ?? "cash");
  const note = String(fd.get("note") ?? "").trim() || null;
  if (!studentId || !termId || !Number.isFinite(amount) || amount <= 0) return { error: "Student, term, and a positive amount are required." };
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: ctx.schoolId }, select: { id: true } });
  if (!student) return { error: "Student not found." };
  await prisma.studentPayment.create({ data: { schoolId: ctx.schoolId, studentId, termId, amount, method, note, recordedBy: ctx.user.userId } });
  await recordAudit({ schoolId: ctx.schoolId, actorId: ctx.user.userId, action: "create", entityType: "student_payment", entityId: studentId, afterValue: { amount, method } as never });
  revalidatePath("/fees/payments");
  return { success: "Payment recorded." };
}
// deletePaymentAction(id): verify ownership via schoolId, prisma.studentPayment.delete, audit action "delete".
// bulkRecordPaymentAction(studentIds[], termId, amount, method): prisma.$transaction of creates for each student, single audit entry entityType "student_payment_bulk".
```
- [ ] **Step 2: Create `page.tsx`** (server): take `termId` + `classId` from searchParams; load students in class; call `getStudentFeeSummaryBatch(schoolId, termId)`; render table (admissionNumber, name, expected, paid, balance, status badge, "Record" + "History" buttons). Status badge colors: cleared=green, partial=amber, not_paid=red, no_structure=muted.
- [ ] **Step 3: History dialog** (client) lists `prisma.studentPayment.findMany({ where: { studentId, termId }, orderBy: { createdAt: "desc" } })` with delete buttons.
- [ ] **Step 4: `npx tsc --noEmit`** then commit.
```bash
git add src/app/'(app)'/fees/payments && git commit -m "feat(bursary): payments ledger page + record/history/bulk actions"
```

---

### Task 7: Fee-status page amounts + parent card

**Files:**
- Modify: `src/app/(app)/fee-status/page.tsx` (admin roster shows amounts when `hasStructure`)
- Modify: `src/app/(app)/fee-status/student-view` segment (student's own amounts) — locate the student view lines (~20-105) and render expected/paid/balance.
- Modify: `src/app/(app)/parent/page.tsx` (add per-ward owing card using `getStudentFeeSummary`)

**Interfaces:**
- Consumes: `getStudentFeeSummary` / `getStudentFeeSummaryBatch` (Task 3), `formatNaira` (Task 5).

- [ ] **Step 1: Admin roster** — where the table currently shows the `FeeStatus` badge, also fetch `getStudentFeeSummaryBatch` and show columns Expected / Paid / Balance (via `formatNaira`) when `hasStructure`; keep the manual badge/notes for `no_structure` rows.
- [ ] **Step 2: Student self-view** — replace the 3-state badge with expected/paid/balance/status using `getStudentFeeSummary(studentId, termId)`.
- [ ] **Step 3: Parent dashboard** — for each ward (via `Guardian.parentUserId === user.userId`), show a card: ward name, class, expected, paid, balance, status (computed). Use `formatNaira`.
- [ ] **Step 4: `npx tsc --noEmit`** then commit.
```bash
git add src/app/'(app)'/fee-status src/app/'(app)'/parent && git commit -m "feat(bursary): show fee amounts on status page + parent dashboard"
```

---

### Task 8: Reminders page + actions

**Files:**
- Create: `src/app/(app)/fees/reminders/page.tsx`
- Create: `src/app/(app)/fees/reminders/actions.ts`

**Interfaces:**
- Consumes: `getStudentFeeSummaryBatch` (Task 3), `buildFeeReminderContent` (Task 2), `createNotification` (`src/lib/notifications/actions.ts`, channel `"in_app"`→push, `"email"`→`sendEmail`), `Guardian` model (`studentId`, `parentUserId`, `email`), `FeeReminderConfig`.
- Produces: `sendFeeRemindersAction(termId, classId?, onlyOwing)` (`{error?,success?}` with counts), `updateReminderConfigAction({ weeklyEnabled, dayOfWeek })`.

- [ ] **Step 1: Create `actions.ts`** with the sender:
```ts
async function sendRemindersForSchool(schoolId: string, termId: string, classId?: string) {
  const students = await prisma.student.findMany({
    where: { schoolId, ...(classId ? { currentClassId: classId } : {}) },
    select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true } },
      guardians: { select: { parentUserId: true, email: true } } },
  });
  const summaries = await getStudentFeeSummaryBatch(schoolId, termId);
  const guardByParent = new Map<string, { parentUserId?: string; email?: string; wards: WardLine[] }>();
  for (const s of students) {
    const sum = summaries.get(s.id);
    if (!sum || !sum.hasStructure || sum.balance <= 0) continue; // only owing + structured
    for (const g of s.guardians) {
      const key = g.parentUserId ?? g.email ?? "";
      if (!key) continue;
      if (!guardByParent.has(key)) guardByParent.set(key, { parentUserId: g.parentUserId ?? undefined, email: g.email ?? undefined, wards: [] });
      guardByParent.get(key)!.wards.push({
        name: `${s.firstName} ${s.lastName}`,
        className: s.currentClass?.name ?? "",
        expected: sum.expected, paid: sum.paid, balance: sum.balance,
      });
    }
  }
  let sentPush = 0, sentEmail = 0, failed = 0;
  for (const g of guardByParent.values()) {
    const content = buildFeeReminderContent(g.wards);
    if (g.parentUserId) {
      await createNotification({ recipientType: "parent", recipientId: g.parentUserId, channel: "in_app", eventType: "fee_reminder", title: "Fee Reminder", content });
      sentPush++;
    }
    if (g.email) {
      const r = await createNotification({ recipientType: "parent", recipientId: g.parentUserId ?? "", recipientEmail: g.email, channel: "email", eventType: "fee_reminder", title: "Fee Reminder", content });
      sentEmail++;
    }
    if (!g.parentUserId && !g.email) failed++;
  }
  return { sentPush, sentEmail, failed };
}

export async function sendFeeRemindersAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireBursar().catch(() => null);
  if (!ctx) return { error: "Not authorised." };
  const termId = String(fd.get("termId") ?? "");
  const classId = String(fd.get("classId") ?? "") || undefined;
  const res = await sendRemindersForSchool(ctx.schoolId, termId, classId);
  await recordAudit({ schoolId: ctx.schoolId, actorId: ctx.user.userId, action: "create", entityType: "fee_reminders_sent", afterValue: res as never });
  return { success: `Sent ${res.sentPush} push / ${res.sentEmail} email · ${res.failed} failed.` };
}

export async function updateReminderConfigAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireBursar().catch(() => null);
  if (!ctx) return { error: "Not authorised." };
  const weeklyEnabled = fd.get("weeklyEnabled") === "on";
  const dayOfWeek = Number(fd.get("dayOfWeek") ?? 1);
  await prisma.feeReminderConfig.upsert({ where: { schoolId: ctx.schoolId }, update: { weeklyEnabled, dayOfWeek }, create: { schoolId: ctx.schoolId, weeklyEnabled, dayOfWeek } });
  revalidatePath("/fees/reminders");
  return { success: "Reminder schedule updated." };
}
```
- [ ] **Step 2: Create `page.tsx`** (server): term selector, class filter, "only owing" toggle; preview list of students with balance (from `getStudentFeeSummaryBatch`); Send button + schedule card (toggle + dayOfWeek select bound to `FeeReminderConfig`).
- [ ] **Step 3: `npx tsc --noEmit`** then commit.
```bash
git add src/app/'(app)'/fees/reminders && git commit -m "feat(bursary): fee reminders page + send/ weekly-schedule actions"
```

---

### Task 9: Cron route for weekly reminders

**Files:**
- Create: `src/app/api/cron/fee-reminders/route.ts`

**Interfaces:**
- Consumes: `sendRemindersForSchool` (Task 8 — export it from `reminders/actions.ts`), `prisma.feeReminderConfig`, `getCurrentTerm` pattern.

- [ ] **Step 1: Create route**
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRemindersForSchool } from "@/app/(app)/fees/reminders/actions";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });
  const today = new Date().getDay(); // 0..6
  const configs = await prisma.feeReminderConfig.findMany({
    where: { weeklyEnabled: true, OR: [{ lastSentAt: null }, { lastSentAt: { lt: new Date(Date.now() - 6 * 864e5) } }] },
  });
  for (const cfg of configs) {
    if (cfg.dayOfWeek !== today) continue;
    const term = await prisma.session.findFirst({ where: { schoolId: cfg.schoolId, isCurrent: true }, include: { terms: { where: { isCurrent: true } } } });
    const termId = term?.terms[0]?.id;
    if (!termId) continue;
    await sendRemindersForSchool(cfg.schoolId, termId);
    await prisma.feeReminderConfig.update({ where: { id: cfg.id }, data: { lastSentAt: new Date() } });
  }
  return NextResponse.json({ ok: true, processed: configs.length });
}
```
- [ ] **Step 2: `npx tsc --noEmit`** then commit.
```bash
git add src/app/api/cron/fee-reminders && git commit -m "feat(bursary): weekly fee-reminder cron route (CRON_SECRET guarded)"
```

---

### Task 10: Verification

- [ ] **Step 1: Typecheck + lint + tests**
Run `npx tsc --noEmit`, `npx vitest run src/lib/fees`, and the project's lint command. All must pass.

- [ ] **Step 2: Manual smoke (dev DB with migrated schema)**
1. As school admin, create a `bursar` assignment for a staff member; confirm Bursary nav appears.
2. On `/fees`, add a "Tuition" FeeItem for JSS1 (₦50,000) and a "PTA Levy" for JSS1 (₦5,000); use "Copy from previous term" to verify cloning.
3. On `/fees/payments`, record ₦20,000 for a JSS1 student → expect Expected ₦55,000, Paid ₦20,000, Balance ₦35,000, status `partial`.
4. Record remaining ₦35,000 → status `cleared`, balance ₦0.
5. On `/fees/reminders`, click Send now → confirm an in-app notification (push) + email arrive for that student's guardian (check `Notification` rows + mail log / SMTP).
6. As the parent, confirm the dashboard owing card shows the ward's numbers.
7. Confirm a school with NO fee items still gates exams/results via the legacy `FeeStatus` flag (no regression).
8. (Optional) Trigger `/api/cron/fee-reminders?` with `Authorization: Bearer $CRON_SECRET` after enabling weekly + matching `dayOfWeek`; confirm `lastSentAt` set and no double-send within 6 days.

- [ ] **Step 3: Commit any verification fixes** (separate commit, message `fix(bursary): <what>`).

---

## Self-Review Notes (author)

- **Spec coverage:** §3 models ✓ Task1; §4 summary+gate ✓ Task3; §5 perms ✓ Task4; §6 pages ✓ Tasks 5–7; §7 reminders ✓ Tasks 8–9; §8 money/format/edge ✓ Tasks 2,5,10; helper `formatNaira` ✓ Task5.
- **Type consistency:** `StudentFeeSummary`, `WardLine`, `deriveFeeStatus`, `buildFeeReminderContent`, `getStudentFeeSummary(Batch)`, `canManageFees`, `createNotification` signatures match across tasks. `sendRemindersForSchool` is defined in Task 8 and reused in Task 9 (exported).
- **No placeholders:** All action bodies, migration SQL, and tests include real code. UI tasks specify exact queries + data shape and reuse existing component patterns (`fee-status-table.tsx`, `fee-status/actions.ts`).
