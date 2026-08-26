### Task 4 Report: Permissions + navigation

**Status:** DONE

**Commit:** ca48df39c22f02dc291f9250713191708c87c30a

**tsc summary:** `npx tsc --noEmit` → 0 errors (after `grep -v next.config.ts`).

**Changes made:**

1. `src/lib/auth/permissions.ts`
   - Added `isBursar: boolean;` to the `EffectivePermissions` interface (after `isFeeStatusManager`).
   - Added `isBursar: false` to the `empty` permissions object.
   - In the assignment loop switch, added `case "bursar": result.isBursar = true; break;` — computed consistently with `isFeeStatusManager`/`isSchoolAdmin` (set when the assignment's `assignmentType === "bursar"`). Note: owner/proprietor short-circuit returns `empty` (isBursar false) which matches existing behaviour for other role flags; bursars are assignment-driven only.
   - Added the verbatim `canManageFees(perms)` helper after `resolvePermissions`/`canManageSchool`.

2. `src/lib/nav.ts`
   - Imported `canManageFees` from `@/lib/auth/permissions`.
   - In the `admin` branch, after the `Fee Status` line and before the `System` group, added the verbatim `Bursary` nav group with children `/fees` (Fee Menu), `/fees/payments` (Payments), `/fees/reminders` (Reminders), gated by `canManageFees(perms)`.
   - Note: The brief's code uses a `canManageFees` guard rather than a `roles` array; `NavItem` has no `roles` field, so the brief's verbatim form was followed. This means the Bursary group appears for super_admin, school_admin, fee_status_manager, and bursar roles (only within the admin branch currently). Teachers who are only `isFeeStatusManager` (non-admin branch) do not get the Bursary group — see concern below.

3. `src/lib/nav.test.ts`
   - Added `isBursar: false` to the `teacherPerms()` fixture to satisfy the updated `EffectivePermissions` interface (required for tsc to pass).

**Verification:**
- `npx tsc --noEmit 2>&1 | grep -v next.config.ts` → no error lines.
- DB unreachable; no live runtime checks performed.

**Concerns:**
- The Bursary nav group is placed inside the `if (admin)` branch. `canManageFees` also returns true for `isFeeStatusManager` (who may not be `isSchoolAdmin`). In the non-admin "Generic staff" branch, fee_status_managers get a `Fee Status` link but NOT the new Bursary group. If fee-status managers should also see Bursary without full admin access, the group should be moved outside the `admin` branch (e.g. mirrored into the generic-staff branch). Flagging for product confirmation; not changed to stay minimal per the brief.
- `proprietor`/owner role short-circuits and returns `empty` (isBursar false). Owners are not auto-bursars, consistent with existing flags; they can still be granted `canManageFees` via the `admin` branch (isSchoolAdmin false for proprietor, so they do NOT get the Bursary group unless they hold a school_admin/bursar assignment). The task description mentioned "school admins/owners" — owners only get admin nav if `isSchoolAdmin` resolves true. This matches existing owner handling and was not altered.

## FIX APPLIED (2026-08-26)

**Change:** Moved the `Bursary` nav group OUT of the `if (admin) { ... }` branch in `src/lib/nav.ts` and added it AFTER the `if/else if/else` chain (just before the `My Profile` link), gated on `canManageFees(perms)`.

**Why:** A pure `bursar` is not `isSchoolAdmin`, so the old placement (inside the `admin` branch) hid the Bursary group from them. With the new placement the group shows for owner / school_admin / teacher-with-fee-perm / bursar — any role for which `canManageFees` returns true, regardless of the admin flag.

**Details:**
- Removed the Bursary block (label "Bursary", children Fee Menu `/fees`, Payments `/fees/payments`, Reminders `/fees/reminders`) from the `admin` push.
- Added it after the generic-staff `else` block (after line ~166) as:
  ```ts
  if (canManageFees(perms)) {
    items.push({
      label: "Bursary",
      icon: "account_balance_wallet",
      children: [
        { label: "Fee Menu", href: "/fees", icon: "receipt_long" },
        { label: "Payments", href: "/fees/payments", icon: "payments" },
        { label: "Reminders", href: "/fees/reminders", icon: "campaign" },
      ],
    });
  }
  ```
- `canManageFees` was already imported at line 2 (`import { canManageFees } from "@/lib/auth/permissions"`), no new import needed.
- Icon strings (`account_balance_wallet`, `receipt_long`, `payments`, `campaign`) are all valid: `NavItem.icon` is typed as `string`, and `account_balance_wallet`, `payments`, and `campaign` are already used elsewhere in the file; `receipt_long` is a free-string also accepted by the type.
- `npx tsc --noEmit 2>&1 | grep -v next.config.ts` → 0 errors (the only tsc error is a pre-existing unrelated `next.config.ts` eslint config error).
