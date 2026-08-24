# Messaging Audience Picker & Bulk Send — Design

Date: 2026-08-24
Status: Approved (user confirmed approach + HOD scope)

## Problem

1. **Admins cannot message students or parents.** `getMessageRecipientsAction` /
   `searchRecipientsAction` (`src/app/(app)/messages/actions.ts`) only implement
   branches for senders with `role === "staff"` (→ staff recipients) and
   `role === "parent"` (→ staff of ward's school). School admins hold roles
   `super_admin` / `proprietor` / `platform_owner`, which fall through to an
   **empty recipient list**.
2. **No filtering.** Recipient selection is a flat list / email-contains search.
   Admin cannot target by class or name.
3. **No bulk sends.** Admin cannot message all teachers / all students / all
   parents / parents by fee clearance in one action.
4. **Students have no Messages access** (`src/lib/nav.ts` gives them no entry),
   so even a successfully created admin→student thread is unreadable by the
   student.

## Decisions (confirmed with user)

| Decision | Choice |
|---|---|
| Bulk delivery model | Private 1:1 conversation per recipient (deduped) |
| Student access | Students get Messages nav; read/reply; may start threads with school staff |
| Bulk composer access | School admins **and HODs**, both with full-school reach |
| Regular teachers | No bulk tools |
| Filtering | Teachers: name/email search. Students & parents: class dropdown and/or name search |
| Fee audiences | Parents whose ward's current-term `FeeStatus.status` matches selected statuses |
| Resolution trust | Client sends audience *spec*; server resolves recipients |

## Architecture

### Server (`src/app/(app)/messages/actions.ts`)

1. **Role-matrix fix.** Introduce
   `isMessagingStaff(role) = role ∈ {"staff","super_admin","proprietor","platform_owner"}`
   and use it in both legacy recipient functions so admins keep working through
   existing paths (individual compose fallback). Add a student-sender branch:
   students may list/start conversations with staff of their school.
2. **`searchDirectoryAction(input)`** — individual picker feed.
   - Input: `{ type: "teacher"|"student"|"parent", classId?: string, query?: string, take?: number }`
   - Output: candidates `{ id, label, sublabel? }`
     - teacher → `User(role="staff")` in school; label = name or email.
     - student → Student records joined to their login `User` via the nullable
       unique `Student.userId` (`schema.prisma`, `model Student`); students
       without a linked User are skipped for messaging; filtered by class
       and/or name/admission-number match.
     - parent → `Guardian(parentUserId != null)` joined to User, deduped by
       `parentUserId`; label = guardian fullName, sublabel = ward name + class.
3. **`countAudienceAction(spec)`** → `{ count }` for the preview chip.
4. **`bulkSendAction(spec, subject, body)`**
   - Guard: `requireSchoolAdmin()` OR resolved `perms.isHod`.
   - Spec: `{ audienceType: "teachers"|"students"|"parents"|"parents_by_fee",
     feeStatuses?: ("cleared"|"partial"|"not_cleared")[], classId?: string }`
   - Resolution rules:
     - `parents` → all Guardians with `parentUserId != null` in school, deduped
       by parentUserId.
     - `parents_by_fee` → join `FeeStatus` for the **current term**
       (term resolution mirrors the pattern in `notifications/event-hooks.ts`);
       keep students whose status ∈ `feeStatuses`; rows **missing** count as
       `not_cleared` but only when `"not_cleared"` is among the requested
       statuses; then Guardians as above; apply optional `classId`.
     - `teachers` → all staff-role Users; `students` → student Users. Exclude
       the sender.
   - Hard cap **1,000** recipients per send (error above the cap).
   - Fan-out: per recipient create Conversation + two ConversationParticipants
     + first Message (reuse the shape of `createConversationAction`), then
     `createNotification(... eventType: "new_message" ...)` so in-app + FCM push
     ride the existing pipeline. Sender is excluded from notifications.
   - Returns `{ sent: number }`; logs per-item failures without aborting the
     whole batch where Prisma allows.

### Client (`compose-form.tsx` rewrite; props from `compose/page.tsx`)

- Segmented mode switch: **Individual | Bulk**. Bulk tab renders only when the
  page passes `canBulk = canManageSchool(perms) || perms.isHod`.
- **Individual**: audience select (Teacher/Student/Parent) → for Student/Parent
  show class `<select>` + search input (either alone works); Teacher shows
  search only. Debounced results list; selecting one enables subject + message;
  submit reuses `createConversationAction`.
- **Bulk**: audience choice cards (All teachers / All students / All parents /
  Parents by fee status); when fee audience, multi-checkboxes for statuses
  (`not cleared`, `partially cleared`, `cleared`); optional class filter shown
  for student/parent audiences; live count via `countAudienceAction`
  (debounced ~300 ms); confirmation dialog states exact count before submit;
  success toast shows `{sent}`.
- Page passes the school's classes (same source as students directory page).

### Student access

- `src/lib/nav.ts`: add Messages item to the student nav group.
- Thread read/reply already works via participant checks once threads exist;
  student-initiated threads go through the fixed role matrix (students → staff).

## Error handling

- Zero-match audience → visible "No recipients match this filter" (client +
  server error return).
- Cap exceeded → explicit error naming the cap.
- Mid-batch failure → continue remaining recipients; final response reports
  `{ sent }` and server logs failures. Notification failures never throw
  (existing contract of `createNotification`).

## Testing

Follow the repo's existing `*.test.ts` colocated pattern:

- Audience resolution unit tests: fee-status join incl. missing-row-as-not_cleared,
  parent dedupe across multiple wards, class filter, cap enforcement, sender exclusion.
- Role matrix tests: super_admin / proprietor / platform_owner / hod reach;
  teacher has no bulk path; student sender branch.
- Existing tests in `push.test.ts` / `actions.test.ts` style; run with the
  project's test script.

## Out of scope

Group conversations, attachments, read receipts, teacher-facing bulk tools,
per-class HOD scoping (HODs chosen to have admin-equal reach).
