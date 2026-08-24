# Messaging Audience Picker & Bulk Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins/HODs can message students & parents individually (class/name filters) and bulk-send private 1:1 messages to all teachers / all students / all parents / parents by fee status; students get Messages access; the admin role-matrix bug is fixed at its root.

**Architecture:** Audience resolution lives in a testable lib (`src/lib/messages/audience.ts`) that takes an audience *spec* and resolves recipient user-ids server-side via Prisma; thin `"use server"` wrappers in `messages/actions.ts` add auth/guards; the compose form gains Individual-directory and Bulk modes; notifications reuse `createNotification` so FCM push rides along automatically.

**Tech Stack:** Next.js 16 App Router, server actions, Prisma 6, vitest, existing Tailwind token classes.

**Spec:** `docs/superpowers/specs/2026-08-24-messaging-audience-bulk-design.md`

## Global Constraints

- No new npm dependencies. Test runner is **vitest** (`npm test`, single file: `npx vitest run <path>`).
- New UI reuses existing token classes seen in `compose-form.tsx` (`font-label-sm text-label-sm`, `bg-surface-container-lowest`, `border-outline-variant`, etc.). No new deps.
- Files exporting server actions start with `"use server"` and may only export async functions.
- Schema facts (verified): current-term lookup `{ where: { session: { schoolId }, isCurrent: true } }`; `FeeStatus{studentId,termId,status}` unique `[studentId,termId]`, status ∈ `cleared|partial|not_cleared`; `Student.userId String? @unique`; `Guardian.parentUserId String?`; `Class.name`; `User.staff Staff?` → `Staff.fullName`; **no** `Student.feeStatuses` back-relation → missing-row detection computed in JS.
- Roles: `UserRole` enum is ONLY `super_admin | platform_owner | proprietor | staff | student | parent | referral` (verified). Teachers, HODs, and school-admins are ALL role `"staff"`; their capabilities come from `ResolvedAssignment.type` (`AssignmentType`: `subject_teacher`, `hod`, `school_admin`, …). HOD = assignment with `type === "hod"`; school-admin = `type === "school_admin"` (sets `isSchoolAdmin`). `canManageSchool(perms)` = `isSuperAdmin || isSchoolAdmin`.
- Bulk cap = **1,000** recipients per send.

---

### Task 1: Role helpers (`src/lib/messages/roles.ts`)

**Files:**
- Create: `src/lib/messages/roles.ts`
- Test: `src/lib/messages/roles.test.ts`

**Interfaces:**
- Produces: `MESSAGING_STAFF_ROLES` (readonly tuple), `isMessagingStaffRole(role: UserRole): boolean`, `participantTypeForRole(role: UserRole): "staff" | "student" | "parent"` — consumed by Tasks 4–6. Binding contract (verified schema): `UserRole` enum is ONLY `super_admin | platform_owner | proprietor | staff | student | parent | referral` — there is NO `teacher`/`hod`/`admin` role. Teachers, HODs, and school-admins are ALL role `"staff"`; their capabilities come from `AssignmentType` (`subject_teacher`, `hod`, `school_admin`) on `ResolvedAssignment.type`. `MESSAGING_STAFF_ROLES = {super_admin, platform_owner, proprietor, staff}`. `participantTypeForRole` returns one of the three values the rest of the system understands (`ConversationParticipant.userType` String conventionally `staff|student|parent`; `CreateNotificationInput.recipientType` typed `"student"|"parent"|"staff"`; `resolvePushUserIds` only delivers push for `parent|student|staff`). Mapping: `student → "student"`, `parent → "parent"`, everything else (super_admin/proprietor/platform_owner/staff/unknown) → `"staff"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/messages/roles.test.ts
import { describe, it, expect } from "vitest";
import type { UserRole } from "@prisma/client";
import { isMessagingStaffRole, participantTypeForRole } from "./roles";

describe("isMessagingStaffRole", () => {
  it("treats school staff and admin roles as messaging staff", () => {
    expect(isMessagingStaffRole("super_admin")).toBe(true);
    expect(isMessagingStaffRole("platform_owner")).toBe(true);
    expect(isMessagingStaffRole("proprietor")).toBe(true);
    expect(isMessagingStaffRole("staff")).toBe(true); // teachers, HODs, school-admins are all role "staff"
  });
  it("rejects non-staff roles", () => {
    for (const r of ["student", "parent", "referral", ""] as UserRole[]) {
      expect(isMessagingStaffRole(r)).toBe(false);
    }
  });
});

describe("participantTypeForRole", () => {
  it("maps roles to participant types", () => {
    expect(participantTypeForRole("super_admin")).toBe("staff");
    expect(participantTypeForRole("platform_owner")).toBe("staff");
    expect(participantTypeForRole("proprietor")).toBe("staff");
    expect(participantTypeForRole("staff")).toBe("staff");
    expect(participantTypeForRole("student")).toBe("student");
    expect(participantTypeForRole("parent")).toBe("parent");
    expect(participantTypeForRole("referral")).toBe("staff");
    expect(participantTypeForRole("" as UserRole)).toBe("staff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/messages/roles.test.ts`
Expected: FAIL — cannot resolve `./roles`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/messages/roles.ts

import type { UserRole } from "@prisma/client";

/** Sender/participant roles that behave like school staff in messaging. */
export const MESSAGING_STAFF_ROLES = [
  "super_admin", "platform_owner", "proprietor", "staff",
] as const;

export function isMessagingStaffRole(role: UserRole): boolean {
  return (MESSAGING_STAFF_ROLES as readonly string[]).includes(role);
}

export type ParticipantType = "staff" | "student" | "parent";

/** ConversationParticipant.userType value for a User.role. */
export function participantTypeForRole(role: UserRole): ParticipantType {
  if (role === "student") return "student";
  if (role === "parent") return "parent";
  return "staff";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/messages/roles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages/roles.ts src/lib/messages/roles.test.ts
git commit -m "feat(messages): shared role helpers for messaging participants"
```

---

### Task 2: Audience resolution lib + basic audiences

**Files:**
- Create: `src/lib/messages/audience.ts`
- Test: `src/lib/messages/audience.test.ts`

**Interfaces:**
- Consumes: `@/lib/prisma` (mocked like `push.test.ts`).
- Produces (consumed by Tasks 3–7): `type AudienceType = "teachers"|"students"|"parents"|"parents_by_fee"`; `type FeeStatusValue = "cleared"|"partial"|"not_cleared"`; `interface AudienceSpec { audienceType: AudienceType; classId?: string; feeStatuses?: FeeStatusValue[] }`; `interface DirectoryQuery { type: "teacher"|"student"|"parent"; classId?: string; query?: string }`; `interface DirectoryEntry { id: string; label: string; sublabel?: string; type: "staff"|"student"|"parent" }`; `const BULK_SEND_CAP = 1000`; `resolveAudienceUserIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string|null): Promise<string[]>`; `countAudience(schoolId: string, spec: AudienceSpec, excludeUserId?: string|null): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/messages/audience.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindMany = vi.fn();
const mockStudentFindMany = vi.fn();
const mockGuardianFindMany = vi.fn();
const mockFeeStatusFindMany = vi.fn();
const mockTermFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    student: { findMany: (...a: unknown[]) => mockStudentFindMany(...a) },
    guardian: { findMany: (...a: unknown[]) => mockGuardianFindMany(...a) },
    feeStatus: { findMany: (...a: unknown[]) => mockFeeStatusFindMany(...a) },
    term: { findFirst: (...a: unknown[]) => mockTermFindFirst(...a) },
  },
}));

import { resolveAudienceUserIds, countAudience, BULK_SEND_CAP } from "./audience";

beforeEach(() => {
  [mockUserFindMany, mockStudentFindMany, mockGuardianFindMany, mockFeeStatusFindMany, mockTermFindFirst].forEach((m) => m.mockReset());
});

describe("teachers audience", () => {
  it("returns staff ids excluding the sender", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "teachers" }, "u1");
    expect(ids).toEqual(["u2"]);
  });
  it("never applies class filter", async () => {
    mockUserFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "teachers", classId: "c9" });
    expect(mockUserFindMany.mock.calls[0][0].where.role).toBe("staff");
    expect(mockUserFindMany.mock.calls[0][0].where.currentClassId).toBeUndefined();
  });
});

describe("students audience", () => {
  it("skips no-login students and the sender; applies class filter", async () => {
    mockStudentFindMany.mockResolvedValue([{ userId: "u5" }, { userId: "u1" }, { userId: null }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "students", classId: "c1" }, "u1");
    expect(ids).toEqual(["u5"]);
    const where = mockStudentFindMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBe("c1");
    expect(where.userId).toEqual({ not: null });
  });
});

describe("parents audience", () => {
  it("dedupes guardians sharing one parent user; excludes sender", async () => {
    mockGuardianFindMany.mockResolvedValue([{ parentUserId: "p1" }, { parentUserId: "p1" }, { parentUserId: "p2" }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "parents" }, "p2");
    expect(ids).toEqual(["p1"]);
    const where = mockGuardianFindMany.mock.calls[0][0].where;
    expect(where.parentUserId).toEqual({ not: null });
    expect(where.student.schoolId).toBe("s1");
  });
  it("applies class filter through the ward student", async () => {
    mockGuardianFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "parents", classId: "c3" });
    expect(mockGuardianFindMany.mock.calls[0][0].where.student.currentClassId).toBe("c3");
  });
});

describe("countAudience / cap", () => {
  it("equals resolved list length", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "b" }]);
    expect(await countAudience("s1", { audienceType: "teachers" })).toBe(3);
  });
  it("BULK_SEND_CAP is 1000 per spec", () => {
    expect(BULK_SEND_CAP).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: FAIL — cannot resolve `./audience`.

- [ ] **Step 3: Write minimal implementation** (fee audience arrives in Task 3 — stub it here)

```ts
// src/lib/messages/audience.ts
import { prisma } from "@/lib/prisma";

export type AudienceType = "teachers" | "students" | "parents" | "parents_by_fee";
export type FeeStatusValue = "cleared" | "partial" | "not_cleared";

export interface AudienceSpec {
  audienceType: AudienceType;
  classId?: string;
  /** Only meaningful for parents_by_fee. */
  feeStatuses?: FeeStatusValue[];
}

export interface DirectoryQuery {
  type: "teacher" | "student" | "parent";
  classId?: string;
  query?: string;
}

export interface DirectoryEntry {
  id: string;
  label: string;
  sublabel?: string;
  type: "staff" | "student" | "parent";
}

export const BULK_SEND_CAP = 1000;

async function teacherIds(schoolId: string, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { schoolId, role: "staff", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function studentIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.student.findMany({
    where: {
      schoolId,
      userId: { not: null },
      ...(spec.classId ? { currentClassId: spec.classId } : {}),
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId).filter((id): id is string => !!id && id !== excludeUserId);
}

async function guardianParentIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.guardian.findMany({
    where: {
      parentUserId: { not: null },
      student: { schoolId, ...(spec.classId ? { currentClassId: spec.classId } : {}) },
    },
    select: { parentUserId: true },
  });
  return [...new Set(rows.map((r) => r.parentUserId))].filter(
    (id): id is string => !!id && id !== excludeUserId,
  );
}

/** Replaced with the real body in Task 3. */
async function parentsByFeeIds(_schoolId: string, _spec: AudienceSpec, _excludeUserId?: string | null): Promise<string[]> {
  return [];
}

/**
 * Resolve every recipient user id for an audience spec.
 * Returns [] when nothing matches (e.g. no current term set).
 */
export async function resolveAudienceUserIds(
  schoolId: string,
  spec: AudienceSpec,
  excludeUserId?: string | null,
): Promise<string[]> {
  switch (spec.audienceType) {
    case "teachers": return teacherIds(schoolId, excludeUserId);
    case "students": return studentIds(schoolId, spec, excludeUserId);
    case "parents": return guardianParentIds(schoolId, spec, excludeUserId);
    case "parents_by_fee": return parentsByFeeIds(schoolId, spec, excludeUserId);
  }
}

export async function countAudience(
  schoolId: string,
  spec: AudienceSpec,
  excludeUserId?: string | null,
): Promise<number> {
  return (await resolveAudienceUserIds(schoolId, spec, excludeUserId)).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages/audience.ts src/lib/messages/audience.test.ts
git commit -m "feat(messages): server-side audience resolution (teachers/students/parents)"
```

### Task 3: Fee-status audience (`parents_by_fee`)

**Files:**
- Modify: `src/lib/messages/audience.ts` (replace the `parentsByFeeIds` stub)
- Test: `src/lib/messages/audience.test.ts` (append)

**Interfaces:** unchanged from Task 2.

- [ ] **Step 1: Append failing tests**

```ts
// append to src/lib/messages/audience.test.ts
describe("parents_by_fee audience", () => {
  it("only includes students with an actual not_cleared fee row and dedupes parents", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([{ id: "st1" }, { id: "st2" }]);
    mockFeeStatusFindMany.mockResolvedValue([{ studentId: "st1" }]);
    mockGuardianFindMany.mockResolvedValue([{ parentUserId: "p1" }, { parentUserId: "p1" }, { parentUserId: "p2" }]);

    const ids = await resolveAudienceUserIds(
      "s1",
      { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] },
      "p2",
    );
    expect(ids).toEqual(["p1"]);
    expect(mockStudentFindMany.mock.calls[0][0].where).toEqual({ schoolId: "s1" });
    expect(mockFeeStatusFindMany.mock.calls[0][0].where.studentId).toEqual({ in: ["st1", "st2"] });
    expect(mockGuardianFindMany.mock.calls[0][0].where.studentId).toEqual({ in: ["st1"] });
  });

  it("skips students with no fee row (not treated as not_cleared)", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([{ id: "st1" }, { id: "st2" }]);
    mockFeeStatusFindMany.mockResolvedValue([]);
    mockGuardianFindMany.mockResolvedValue([]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] });
    expect(ids).toEqual([]);
    expect(mockGuardianFindMany).not.toHaveBeenCalled();
  });

  it("returns empty with no current term, and with empty statuses", async () => {
    mockTermFindFirst.mockResolvedValue(null);
    expect(await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["cleared"] })).toEqual([]);
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    expect(await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee" })).toEqual([]);
    expect(mockFeeStatusFindMany).not.toHaveBeenCalled();
  });

  it("applies class filter to the student scope", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([]);
    mockFeeStatusFindMany.mockResolvedValue([]);
    mockGuardianFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"], classId: "c7" });
    expect(mockStudentFindMany.mock.calls[0][0].where.currentClassId).toBe("c7");
  });
});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: FAIL — stub returns `[]`.

- [ ] **Step 3: Replace the stub**

```ts
// in src/lib/messages/audience.ts — replace parentsByFeeIds entirely
async function parentsByFeeIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const statuses = (spec.feeStatuses ?? []).filter((s) =>
    (["cleared", "partial", "not_cleared"] as const).includes(s as FeeStatusValue),
  );
  if (statuses.length === 0) return [];

  const term = await prisma.term.findFirst({
    where: { session: { schoolId }, isCurrent: true },
    select: { id: true },
  });
  if (!term) return [];

  // FeeStatus has NO Student relation (only scalar studentId), so scope
  // students first, then match by studentId in the fee query.
  const students = await prisma.student.findMany({
    where: { schoolId, ...(spec.classId ? { currentClassId: spec.classId } : {}) },
    select: { id: true },
  });
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);

  const matched = await prisma.feeStatus.findMany({
    where: { termId: term.id, status: { in: statuses }, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const studentIdList = matched.map((m) => m.studentId);

  if (studentIdList.length === 0) return [];

  const guardians = await prisma.guardian.findMany({
    where: { studentId: { in: studentIdList }, parentUserId: { not: null } },
    select: { parentUserId: true },
  });
  return [...new Set(guardians.map((g) => g.parentUserId))].filter(
    (id): id is string => !!id && id !== excludeUserId,
  );
}
```

Note: drop the `status: "active"` line from `studentFilter` if `model Student` has no `status` column — verify with `grep -n "status" prisma/schema.prisma` inside the Student block before running tests.

- [ ] **Step 4: Run all audience tests**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages/audience.ts src/lib/messages/audience.test.ts
git commit -m "feat(messages): parents_by_fee audience resolution (current-term fee join; missing rows skipped)"
```

---

### Task 4: Directory search (individual picker feed)

**Files:**
- Modify: `src/lib/messages/audience.ts` (append `searchDirectory`)
- Test: `src/lib/messages/audience.test.ts` (append; add mocks as needed)

**Interfaces:**
- Produces: `searchDirectory(schoolId: string, q: DirectoryQuery): Promise<DirectoryEntry[]>` — consumed by Task 6's `searchDirectoryAction`.
- New prisma mocks needed: `user.findMany` already mocked; add `staff` via include on user rows (no separate model call), `student.findMany`, `guardian.findMany` reused.

- [ ] **Step 1: Append failing tests**

```ts
// append to src/lib/messages/audience.test.ts
import { searchDirectory } from "./audience";

describe("searchDirectory", () => {
  it("teachers: label prefers Staff.fullName over email", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", staff: { fullName: "Ada Obi" } },
      { id: "u2", email: "b@x.com", staff: null },
    ]);
    const out = await searchDirectory("s1", { type: "teacher", query: "" });
    expect(out).toEqual([
      { id: "u1", label: "Ada Obi", sublabel: "a@x.com", type: "staff" },
      { id: "u2", label: "b@x.com", type: "staff" },
    ]);
    expect(mockUserFindMany.mock.calls[0][0].where.role).toBe("staff");
  });

  it("students: returns entries with ward label and admission/class sublabel", async () => {
    mockStudentFindMany.mockResolvedValue([
      { userId: "u5", firstName: "Tunde", lastName: "Bello", admissionNumber: "A01", currentClass: { name: "JSS1A" } },
      { userId: null, firstName: "No", lastName: "Login", admissionNumber: "A02", currentClass: null },
    ]);
    const out = await searchDirectory("s1", { type: "student", query: "tun", classId: "c1" });
    expect(out).toEqual([
      { id: "u5", label: "Tunde Bello", sublabel: "A01 · JSS1A", type: "student" },
    ]);
    const where = mockStudentFindMany.mock.calls[0][0].where;
    expect(where.userId).toEqual({ not: null });
    expect(where.currentClassId).toBe("c1");
    expect(where.OR[0].firstName.contains).toBe("tun");
  });

  it("parents: one entry per guardian user, labeled with ward name and class", async () => {
    mockGuardianFindMany.mockResolvedValue([
      { parentUserId: "p1", fullName: "Mrs Ade",
        student: { firstName: "Tunde", lastName: "Bello", currentClass: { name: "JSS2A" } } },
      { parentUserId: "p1", fullName: "Mrs Ade",
        student: { firstName: "Ada", lastName: "Bello", currentClass: { name: "JSS1A" } } },
    ]);
    const out = await searchDirectory("s1", { type: "parent", query: "" });
    expect(out).toEqual([
      { id: "p1", label: "Mrs Ade", sublabel: "mother of Tunde JSS2A", type: "parent" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: FAIL — `searchDirectory` is not exported.

- [ ] **Step 3: Implement `searchDirectory`** (append to `audience.ts`; add `take = 25` param default inside signature)

```ts
// append to src/lib/messages/audience.ts
export async function searchDirectory(schoolId: string, q: DirectoryQuery): Promise<DirectoryEntry[]> {
  const query = q.query?.trim() ?? "";

  if (q.type === "teacher") {
    const rows = await prisma.user.findMany({
      where: {
        schoolId,
        role: "staff",
        ...(query ? { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { staff: { fullName: { contains: query, mode: "insensitive" as const } } }] } : {}),
      },
      select: { id: true, email: true, staff: { select: { fullName: true } } },
      orderBy: { email: "asc" },
      take: 25,
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.staff?.fullName || r.email,
      ...(r.staff?.fullName ? { sublabel: r.email } : {}),
      type: "staff" as const,
    }));
  }

  if (q.type === "student") {
    const rows = await prisma.student.findMany({
      where: {
        schoolId,
        userId: { not: null },
        ...(q.classId ? { currentClassId: q.classId } : {}),
        ...(query ? { OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { admissionNumber: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
      select: {
        userId: true, firstName: true, lastName: true, admissionNumber: true,
        currentClass: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 25,
    });
    return rows
      .filter((r): r is typeof r & { userId: string } => !!r.userId)
      .map((r) => ({
        id: r.userId,
        label: `${r.firstName} ${r.lastName}`,
        sublabel: [r.admissionNumber, r.currentClass?.name].filter(Boolean).join(" · "),
        type: "student" as const,
      }));
  }

  // parent
  const rows = await prisma.guardian.findMany({
    where: {
      parentUserId: { not: null },
      student: {
        schoolId,
        ...(q.classId ? { currentClassId: q.classId } : {}),
        ...(query ? { OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
      ...(query ? { OR: [
        { fullName: { contains: query, mode: "insensitive" as const } },
      ] } : {}),
    },
    select: {
      parentUserId: true, relationship: true, fullName: true,
      student: { select: { firstName: true, lastName: true, currentClass: { select: { name: true } } } },
    },
    take: 25,
  });
  const seen = new Map<string, DirectoryEntry>();
  for (const r of rows) {
    if (!r.parentUserId || seen.has(r.parentUserId)) continue;
    const cls = r.student.currentClass?.name ?? "";
    seen.set(r.parentUserId, {
      id: r.parentUserId,
      label: r.fullName,
      sublabel: `${r.relationship} of ${r.student.firstName} ${cls}`.trim(),
      type: "parent",
    });
  }
  return [...seen.values()];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/messages/audience.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages/audience.ts src/lib/messages/audience.test.ts
git commit -m "feat(messages): directory search for teachers/students/parents picker"
```

### Task 5: Wire actions — role-matrix fix + directory/count/bulk actions

**Files:**
- Modify: `src/app/(app)/messages/actions.ts`
- Test: `src/app/(app)/messages/actions.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 helpers; Tasks 2–4 exports (`AudienceSpec`, `DirectoryQuery`, `DirectoryEntry`, `resolveAudienceUserIds`, `countAudience`, `searchDirectory`, `BULK_SEND_CAP`).
- Produces (consumed by Tasks 6–7):
  - `searchDirectoryAction(input: DirectoryQuery): Promise<DirectoryEntry[]>`
  - `countAudienceAction(spec: AudienceSpec): Promise<{ count: number }>`
  - `bulkSendAction(spec: AudienceSpec, subject: string, body: string): Promise<{ sent?: number; error?: string }>`

- [ ] **Step 1: Write failing tests** (module-mock style of `push.test.ts`; `"use server"` is inert under vitest)

```ts
// src/app/(app)/messages/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.fn();
const mockResolvePermissions = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockConversationCreate = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
    },
    conversation: { create: (...a: unknown[]) => mockConversationCreate(...a) },
  },
}));
vi.mock("@/lib/notifications/actions", () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: (...a: unknown[]) => mockResolvePermissions(...a),
  canManageSchool: (p: { isSuperAdmin: boolean }) => p.isSuperAdmin,
}));
vi.mock("@/lib/messages/audience", () => ({
  resolveAudienceUserIds: vi.fn(),
  countAudience: vi.fn().mockResolvedValue(0),
  searchDirectory: vi.fn().mockResolvedValue([]),
  BULK_SEND_CAP: 1000,
}));

import { bulkSendAction, getMessageRecipientsAction } from "./actions";
import { resolveAudienceUserIds } from "@/lib/messages/audience";
const resolveMock = vi.mocked(resolveAudienceUserIds);

beforeEach(() => {
  [mockGetCurrentUser, mockResolvePermissions, mockUserFindUnique, mockUserFindMany, mockConversationCreate, resolveMock].forEach((m) => m.mockReset());
});

function adminUser() {
  return { userId: "admin1", role: "super_admin", schoolId: "s1", staffId: null, email: "a@x.com" };
}

describe("bulkSendAction", () => {
  it("rejects plain staff teachers (no admin/HOD assignment)", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "t1", role: "staff", schoolId: "s1", staffId: "st1", email: "t@x.com" });
    mockResolvePermissions.mockResolvedValue({ isSuperAdmin: false, isSchoolAdmin: false, assignments: [] });
    const res = await bulkSendAction({ audienceType: "teachers" }, "Hi", "Body");
    expect(res.error).toBe("Not allowed.");
  });

  it("allows super_admin (role-based) and fans out 1:1 conversations + notifications", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockResolvePermissions.mockResolvedValue({ isSuperAdmin: true, assignments: [] });
    resolveMock.mockResolvedValue(["u1", "u2"]);
    mockUserFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ id: where.id, email: `${where.id}@x.com`, role: where.id === "u1" ? "staff" : "parent", schoolId: "s1" }));
    mockConversationCreate.mockImplementation(async ({ data }: { data: { participants: { create: { userId: string }[] } } }) =>
      ({ id: `conv-${data.participants.create[1].userId}` }));

    const res = await bulkSendAction({ audienceType: "teachers" }, "Hi", "Body");
    expect(res).toEqual({ sent: 2 });
    expect(mockConversationCreate).toHaveBeenCalledTimes(2);
    expect(mockConversationCreate.mock.calls[0][0].data.messages.create.senderId).toBe("admin1");
  });

  it("allows HODs (staff with hod assignment) and fans out", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "hod1", role: "staff", schoolId: "s1", staffId: "st1", email: "h@x.com" });
    mockResolvePermissions.mockResolvedValue({
      isSuperAdmin: false,
      isSchoolAdmin: false,
      assignments: [{ id: "a1", type: "hod", subjectId: "sub1", classId: null, isTemporary: false }],
    });
    resolveMock.mockResolvedValue(["u1", "u2"]);
    mockUserFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ id: where.id, email: `${where.id}@x.com`, role: where.id === "u1" ? "staff" : "parent", schoolId: "s1" }));
    mockConversationCreate.mockImplementation(async ({ data }: { data: { participants: { create: { userId: string }[] } } }) =>
      ({ id: `conv-${data.participants.create[1].userId}` }));

    const res = await bulkSendAction(
      { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] },
      "Fees",
      "Please pay.",
    );
    expect(res).toEqual({ sent: 2 });
    expect(mockConversationCreate).toHaveBeenCalledTimes(2);
    expect(mockConversationCreate.mock.calls[0][0].data.messages.create.senderId).toBe("hod1");
  });

  it("errors on empty audience and over-cap audiences", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockResolvePermissions.mockResolvedValue({ isSuperAdmin: true, assignments: [] });

    resolveMock.mockResolvedValue([]);
    expect((await bulkSendAction({ audienceType: "teachers" }, "S", "B")).error)
      .toBe("No recipients match this audience.");

    resolveMock.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => `u${i}`));
    expect((await bulkSendAction({ audienceType: "teachers" }, "S", "B")).error)
      .toContain("Cap is 1000");
  });
});

describe("role-matrix regression (admins saw nobody)", () => {
  it("getMessageRecipientsAction returns staff for a super_admin sender", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockUserFindMany.mockResolvedValue([{ id: "t1", email: "t@x.com", staffId: null }]);
    const res = await getMessageRecipientsAction();
    expect(res.recipients).toEqual([{ userId: "t1", label: "t@x.com", type: "staff" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/(app)/messages/actions.test.ts"`
Expected: FAIL — `bulkSendAction` not exported; super_admin sender gets no recipients.

- [ ] **Step 3: Implement in `messages/actions.ts`**

Add imports at top:

```ts
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { isMessagingStaffRole, participantTypeForRole } from "@/lib/messages/roles";
import {
  searchDirectory, countAudience, resolveAudienceUserIds, BULK_SEND_CAP,
  type AudienceSpec, type DirectoryQuery, type DirectoryEntry,
} from "@/lib/messages/audience";
```

In `searchRecipientsAction` and `getMessageRecipientsAction`, replace the
`user.role === "staff"` condition with `isMessagingStaffRole(user.role)`, and
add a student-sender branch (after the parent branch in each function):

```ts
  } else if (user.role === "student" && user.schoolId) {
    // Students may contact staff of their own school.
    const staff = await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: "staff" },
      select: { id: true, email: true, staffId: true },
    });
    recipients = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  }
```

(In `searchRecipientsAction` assign to `results` instead of `recipients`.)

Update sender-type derivation in `createConversationAction` (~line 179):

```ts
  const senderType = participantTypeForRole(user.role);
```

Append at the bottom of the file:

```ts
async function canBulkSend(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Promise<boolean> {
  if (!user.schoolId) return false;
  // Top-level school owners are always allowed.
  if (user.role === "super_admin" || user.role === "platform_owner" || user.role === "proprietor") return true;
  const perms = await resolvePermissions(user);
  // school-admin (staff with school_admin assignment) or HOD (staff with hod assignment).
  return canManageSchool(perms) || perms.assignments.some((a) => a.type === "hod");
}

/** Directory feed for the individual composer picker. */
export async function searchDirectoryAction(input: DirectoryQuery): Promise<DirectoryEntry[]> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return [];
  return searchDirectory(user.schoolId, input);
}

/** Live preview count for the bulk composer. */
export async function countAudienceAction(spec: AudienceSpec): Promise<{ count: number }> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { count: 0 };
  return { count: await countAudience(user.schoolId, spec, user.userId) };
}

/** Bulk-send a private 1:1 conversation to every member of an audience. */
export async function bulkSendAction(
  spec: AudienceSpec,
  subject: string,
  body: string,
): Promise<{ sent?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !user.userId || !user.schoolId) return { error: "Not authenticated." };
  if (!(await canBulkSend(user))) return { error: "Not allowed." };
  if (!body.trim()) return { error: "Message cannot be empty." };

  const userIds = await resolveAudienceUserIds(user.schoolId, spec, user.userId);
  if (userIds.length === 0) return { error: "No recipients match this audience." };
  if (userIds.length > BULK_SEND_CAP) {
    return { error: `Too many recipients (${userIds.length}). Cap is ${BULK_SEND_CAP}. Narrow the filters.` };
  }

  const senderType = participantTypeForRole(user.role);
  let sent = 0;

  for (let i = 0; i < userIds.length; i += 20) {
    await Promise.all(userIds.slice(i, i + 20).map(async (recipientId) => {
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true, role: true, schoolId: true },
      });
      if (!recipient || recipient.schoolId !== user.schoolId) return;
      await prisma.conversation.create({
        data: {
          schoolId: user.schoolId!,
          subject: subject.trim() || null,
          participants: {
            create: [
              { userId: user.userId, userType: senderType, userLabel: user.email },
              { userId: recipient.id, userType: participantTypeForRole(recipient.role), userLabel: recipient.email },
            ],
          },
          messages: { create: { senderId: user.userId, content: body.trim() } },
        },
      });
      await createNotification({
        schoolId: user.schoolId!,
        recipientType: participantTypeForRole(recipient.role),
        recipientId: recipient.id,
        channel: "in_app",
        eventType: "new_message",
        title: `New message from ${user.email}`,
        content: body.trim().slice(0, 200),
      });
      sent += 1;
    }));
  }

  await recordAudit({
    schoolId: user.schoolId,
    actorId: user.userId,
    action: "create",
    entityType: "conversation_bulk",
    entityId: `bulk:${Date.now()}`,
    afterValue: { spec, sent } as never,
  });

  revalidatePath("/messages");
  return { sent };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run "src/app/(app)/messages/actions.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/messages/actions.ts" "src/app/(app)/messages/actions.test.ts"
git commit -m "feat(messages): admin/HOD directory + bulk send actions; fix admin/student role matrix"
```

### Task 6: Compose page passes directory props

**Files:**
- Modify: `src/app/(app)/messages/compose/page.tsx`

**Interfaces:**
- Produces props consumed by Task 7: `<ComposeMessageForm recipients useDirectory classes />` with `useDirectory: boolean`, `classes: { id: string; name: string }[]`.

- [ ] **Step 1: Update the page**

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { getMessageRecipientsAction } from "../actions";
import { ComposeMessageForm } from "./compose-form";

export default async function ComposeMessagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await getMessageRecipientsAction();
  if ("error" in result) {
    return <p className="font-body-sm text-body-sm text-red-600">{result.error}</p>;
  }

  const perms = await resolvePermissions(user);
  const canBulk =
    user.role === "super_admin" || user.role === "platform_owner" || user.role === "proprietor" ||
    canManageSchool(perms) || perms.assignments.some((a) => a.type === "hod");
  const classes = canBulk && user.schoolId
    ? await prisma.class.findMany({
        where: { schoolId: user.schoolId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/messages" className="font-label-sm text-label-sm text-primary hover:underline">
        ← Back to Messages
      </a>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mt-2">
        New Message
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Start a new conversation.
      </p>

      <ComposeMessageForm recipients={result.recipients} useDirectory={canBulk} classes={classes} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json` (or rely on `npm run build` at the end)
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/messages/compose/page.tsx"
git commit -m "feat(messages): compose page resolves bulk permission + class list"
```

---

### Task 7: Rewrite compose form — Individual directory + Bulk modes

**Files:**
- Modify: `src/app/(app)/messages/compose/compose-form.tsx` (full rewrite)

**Interfaces:**
- Consumes: Task 5 actions (`searchDirectoryAction`, `countAudienceAction`, `bulkSendAction`), existing `createConversationAction`; types re-exported via a small local `type` import from `"../actions"` is NOT possible (`"use server"` files may not export types) → import types from `@/lib/messages/audience` directly (client-safe, type-only).

- [ ] **Step 1: Replace `compose-form.tsx` with:**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createConversationAction, searchDirectoryAction, countAudienceAction, bulkSendAction } from "../actions";
import type { AudienceSpec, AudienceType, DirectoryEntry, FeeStatusValue } from "@/lib/messages/audience";

interface Props {
  recipients: { userId: string; label: string; type: string }[];
  useDirectory: boolean;
  classes: { id: string; name: string }[];
}

const FEE_OPTIONS: { value: FeeStatusValue; label: string }[] = [
  { value: "not_cleared", label: "Not cleared" },
  { value: "partial", label: "Partially cleared" },
  { value: "cleared", label: "Cleared" },
];

const AUDIENCES: { value: AudienceType; label: string; needsClass: boolean }[] = [
  { value: "teachers", label: "All teachers", needsClass: false },
  { value: "students", label: "All students", needsClass: true },
  { value: "parents", label: "All parents", needsClass: true },
  { value: "parents_by_fee", label: "Parents by fee status", needsClass: true },
];

export function ComposeMessageForm({ recipients, useDirectory, classes }: Props) {
  const [mode, setMode] = useState<"individual" | "bulk">("individual");

  // Individual
  const [dirType, setDirType] = useState<"teacher" | "student" | "parent">("teacher");
  const [classId, setClassId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  // Legacy select for non-admin senders
  const [legacyRecipientId, setLegacyRecipientId] = useState("");

  // Bulk
  const [audienceType, setAudienceType] = useState<AudienceType>("teachers");
  const [feeStatuses, setFeeStatuses] = useState<FeeStatusValue[]>(["not_cleared"]);
  const [bulkCount, setBulkCount] = useState<number | null>(null);

  // Shared
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!useDirectory || mode !== "individual") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = setTimeout(async () => {
      try {
        setResults(await searchDirectoryAction({ type: dirType, classId: classId || undefined, query }));
      } catch {
        setResults([]);
      }
    }, 250);
    debounceRef.current = t;
    return () => clearTimeout(t);
  }, [useDirectory, mode, dirType, classId, query]);

  useEffect(() => {
    if (mode !== "bulk") { setBulkCount(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const spec: AudienceSpec = {
      audienceType,
      ...(classId ? { classId } : {}),
      ...(audienceType === "parents_by_fee" ? { feeStatuses } : {}),
    };
    const valid = audienceType !== "parents_by_fee" || feeStatuses.length > 0;
    if (!valid) { setBulkCount(0); return; }
    const t = setTimeout(async () => {
      try {
        const r = await countAudienceAction(spec);
        setBulkCount(r.count);
      } catch { setBulkCount(null); }
    }, 300);
    debounceRef.current = t;
    return () => clearTimeout(t);
  }, [mode, audienceType, feeStatuses, classId]);

  async function submitIndividual(e: React.FormEvent) {
    e.preventDefault();
    const recipientId = useDirectory ? selected?.id : legacyRecipientId;
    if (!recipientId || !initialMessage.trim()) return;
    setSending(true); setError("");
    const res = await createConversationAction(recipientId, subject, initialMessage);
    if ("error" in res && res.error) { setError(res.error); setSending(false); }
    else if ("conversationId" in res) window.location.href = `/messages/${res.conversationId}`;
  }

  async function submitBulk() {
    if (!initialMessage.trim()) return;
    const count = bulkCount ?? 0;
    if (count === 0) { setError("No recipients match this audience."); return; }
    if (!window.confirm(`Send this message to ${count} recipient${count === 1 ? "" : "s"} as private conversations?`)) return;
    setSending(true); setError("");
    const spec: AudienceSpec = {
      audienceType,
      ...(classId ? { classId } : {}),
      ...(audienceType === "parents_by_fee" ? { feeStatuses } : {}),
    };
    const res = await bulkSendAction(spec, subject, initialMessage);
    setSending(false);
    if (res.error) setError(res.error);
    else setSentCount(res.sent ?? 0);
  }

  if (sentCount !== null) {
    return (
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 text-center space-y-2">
        <p className="font-headline-sm text-headline-sm text-on-surface">Sent to {sentCount} recipient{sentCount === 1 ? "" : "s"}.</p>
        <a href="/messages" className="font-label-md text-label-md text-primary hover:underline">Back to Messages</a>
      </div>
    );
  }

  return (
    <form onSubmit={submitIndividual} className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
      {useDirectory && (
        <div className="flex gap-2">
          {(["individual", "bulk"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded font-label-md text-label-md ${mode === m ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
              {m === "individual" ? "Individual" : "Bulk"}
            </button>
          ))}
        </div>
      )}

      {mode === "individual" && !useDirectory && (
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">To</label>
          <select value={legacyRecipientId} onChange={(e) => setLegacyRecipientId(e.target.value)} required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
            <option value="">Select recipient</option>
            {recipients.map((r) => (
              <option key={r.userId} value={r.userId}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      {mode === "individual" && useDirectory && (
        <>
          <div className="flex gap-2 flex-wrap">
            {([["teacher", "Teacher"], ["student", "Student"], ["parent", "Parent"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setDirType(v); setSelected(null); }}
                className={`px-3 py-1.5 rounded font-label-md text-label-md ${dirType === v ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
                {l}
              </button>
            ))}
          </div>
          {dirType !== "teacher" && (
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(null); }}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder={dirType === "teacher" ? "Search teachers by name or email…" : "Search by name…"}
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
          {!selected && results.length > 0 && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant max-h-56 overflow-y-auto">
              {results.map((r) => (
                <button type="button" key={`${r.type}-${r.id}`}
                  onClick={() => { setSelected(r); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-surface-container-low">
                  <span className="font-label-md text-label-md text-on-surface">{r.label}</span>
                  {r.sublabel && <span className="font-label-sm text-label-sm text-on-surface-variant ml-2">{r.sublabel}</span>}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center gap-2 bg-primary-container/10 border border-outline-variant rounded p-2">
              <span className="font-label-md text-label-md text-on-surface">To: {selected.label}{selected.sublabel ? ` (${selected.sublabel})` : ""}</span>
              <button type="button" onClick={() => setSelected(null)} className="font-label-sm text-label-sm text-primary underline ml-auto">Change</button>
            </div>
          )}
        </>
      )}

      {mode === "bulk" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {AUDIENCES.map((a) => (
              <button key={a.value} type="button"
                onClick={() => { setAudienceType(a.value); if (!a.needsClass) setClassId(""); }}
                className={`px-3 py-2 rounded font-label-md text-label-md text-left ${audienceType === a.value ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
                {a.label}
              </button>
            ))}
          </div>
          {audienceType === "parents_by_fee" && (
            <div className="flex gap-3 flex-wrap">
              {FEE_OPTIONS.map((f) => (
                <label key={f.value} className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
                  <input type="checkbox" checked={feeStatuses.includes(f.value)}
                    onChange={(e) => setFeeStatuses((prev) => e.target.checked ? [...prev, f.value] : prev.filter((s) => s !== f.value))} />
                  {f.label}
                </label>
              ))}
            </div>
          )}
          {AUDIENCES.find((a) => a.value === audienceType)?.needsClass && (
            <select value={classId} onChange={(e) => setClassId(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
              <option value="">Whole school (all classes)</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <p className="font-label-md text-label-md text-on-surface-variant">
            {bulkCount === null ? "Counting recipients…" : `Will send to ${bulkCount} recipient${bulkCount === 1 ? "" : "s"} (private 1:1).`}
          </p>
        </>
      )}

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject (optional)</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          placeholder="What is this about?" />
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Message</label>
        <textarea value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} required rows={5}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          placeholder="Write your message..." />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "individual" ? (
        <button type="submit" disabled={sending || (useDirectory && !selected) || (!useDirectory && !legacyRecipientId)}
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {sending ? "Sending..." : "Send Message"}
        </button>
      ) : (
        <button type="button" onClick={submitBulk} disabled={sending || !bulkCount}
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {sending ? "Sending..." : `Send to ${bulkCount ?? 0} recipients`}
        </button>
      )}
    </form>
  );
}
```

Note: importing **types only** from `@/lib/messages/audience` in a client component is safe (`import type` is erased). If the bundler complains about pulling the module graph, move the three types into a separate `src/lib/messages/types.ts` and re-export from `audience.ts`.

- [ ] **Step 2: Verify compile + tests still green**

Run: `npm test` and `npx tsc --noEmit`
Expected: PASS / no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/messages/compose/compose-form.tsx"
git commit -m "feat(messages): individual directory picker + confirmed bulk composer UI"
```

### Task 8: Student Messages access in nav

**Files:**
- Modify: `src/lib/nav.ts` (student branch, ~line 99)

- [ ] **Step 1: Add the entry**

Inside the `user.role === "student"` branch, insert into `studentItems` after the Fee Status item:

```ts
      { label: "Messages", href: "/messages", icon: "chat" },
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/nav.ts
git commit -m "feat(messages): give students access to Messages"
```

---

### Task 9: Full verification + ship

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all PASS (existing suites untouched).

- [ ] **Step 2: Production build check**

Run: `npm run build`
Expected: succeeds (catches `"use server"` export rules and RSC/client boundary issues).

- [ ] **Step 3: Push feature branch and fast-forward master**

```bash
git push origin feature/android-apk-push
git checkout master && git merge --ff-only feature/android-apk-push && git push origin master && git checkout feature/android-apk-push
```

Vercel deploys master → verify on production: log in as admin → New Message → Bulk tab visible, count preview works, send to a small audience, recipient receives notification.

---

## Self-Review

**Spec coverage:**
- Role-matrix fix (admins/students) → Task 5.
- Individual picker w/ class+name filters; teacher search-only → Tasks 4 & 7.
- Bulk audiences incl. fee statuses, class filter optional → Tasks 3 & 7.
- Server-resolved audiences, client sends spec only → Tasks 5–7.
- Private 1:1 deduped delivery + notifications/push → Tasks 2/3/5.
- Cap 1000 + confirm dialog + `{sent}` summary → Task 7 UI + Task 5 action.
- Student nav access → Task 8.
- HOD access with admin reach → Task 6 (`canBulk`) + guard in Task 5.
- Tests per spec section → Tasks 1–5.

**Type consistency:** `AudienceSpec`/`AudienceType`/`FeeStatusValue`/`DirectoryEntry`/`DirectoryQuery`, `resolveAudienceUserIds(schoolId, spec, excludeUserId?)`, `countAudience(...)` same signature, `BULK_SEND_CAP=1000`, `isMessagingStaffRole`, `participantTypeForRole` used identically across tasks. Form props match Task 6 page exactly (`recipients`, `useDirectory`, `classes`).

**Placeholders:** none — every step carries its code.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-24-messaging-audience-bulk.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
