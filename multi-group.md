# Multi-Branch / Group of Schools Management Guide

This document explains how the Multi-Branch addon () works across all three
consoles — Platform Owner, Proprietor, and School Admin — and how the license
pricing-tier connection operates.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Platform Owner Console Guide](#2-platform-owner-console-guide)
3. [Proprietor Console Guide](#3-proprietor-console-guide)
4. [School Admin Guide](#4-school-admin-guide)
5. [License Fee-Group Connection](#5-license-pricing-tier-connection)
6. [Addon Gating](#6-addon-gating)
7. [Data Model Reference](#7-data-model-reference)

---

## 1. Overview

The Multi-Branch addon lets a proprietor who owns multiple school branches (e.g.
"XYZ Group of Schools — Lekki + Ikeja campuses") view and compare performance
across all their branches from one dashboard, and track students who transfer
between branches — without breaking the per-school tenant isolation
(`school_id` scoping) that every other part of the platform relies on.

### Three distinct tiers

| Role | Scope | What they can do |
|------|-------|-------------------|
| **School Admin** | One school (`school_id`) | Full access within their school only. No cross-branch visibility. |
| **Proprietor** | One School Group (multiple specific schools) | Cross-branch dashboard, comparison views, transfer tracking. Cannot edit individual branch data. |
| **Platform Owner** | Entire platform | Creates School Groups, creates Proprietor accounts, activates the Multi-Branch addon at group level, manages licensing. |

A School Admin **never** gains cross-branch visibility just because their school
belongs to a group — group-wide visibility is exclusively a Proprietor-tier
capability.

---

## 2. Platform Owner Console Guide

**URL:** `/console` (login at `/console/login`)

The Platform Owner is the only person who can create School Groups, manage their
membership, and create Proprietor accounts.

### 2.1 Creating a School Group

1. Navigate to **School Groups** in the sidebar (`/console/groups`).
2. Click **"New Group"**.
3. Enter:
   - **Group name** — e.g. "XYZ Group of Schools"
   - **Connected license pricing tier** — select Basic, Standard, or Premium
     (or leave empty for no override). When set, all member schools will use
     this pricing tier's pricing for license plans and addons, overriding each
     school's individual stage.
4. Click **Create Group**.

### 2.2 Adding Schools to a Group

1. On the group panel, click **"+ Add school"**.
2. Select a school from the dropdown (only schools not already in another group
   appear).
3. Click **Add**.

A school can belong to **at most one group** at a time. To move a school to a
different group, remove it from its current group first.

### 2.3 Removing a School from a Group

1. On the group panel, find the school in the **Member schools** list.
2. Click **Remove**.

Removing a school from a group stops future data from rolling up into that
group's dashboard, but historical Group Student Transfer Records and past
aggregated views involving that school remain intact and accurate as of when
they occurred.

### 2.4 Creating Proprietor Accounts

1. On the group panel, click **"+ Create proprietor"**.
2. Enter:
   - **Full name** — the proprietor's name
   - **Email** — used to log in (must be unique across all users)
   - **Password** — initial password (minimum 8 characters; the proprietor will
     be prompted to change it on first login)
   - **Permission level** —
     - **View-only** — can see everything (dashboard, comparisons, transfers)
       but cannot initiate transfers or take any write action.
     - **Full** — can initiate cross-branch student transfers and view
       everything.
3. Click **Create Proprietor Account**.

The proprietor can now log in at `/proprietor/login` using their email and
password.

### 2.5 Activating the Multi-Branch Addon at Group Level

Unlike other addons (which are activated per-school), the Multi-Branch addon is
activated at the **group level** — a Proprietor's group either has cross-branch
functionality active or it doesn't; individual branches do not separately
subscribe to it.

1. On the group panel, scroll to **Group-level addons**.
2. Find "Multi-Branch / Group of Schools".
3. Click **Activate**.

The addon is now active for the entire group. The price shown is based on the
group's connected pricing tier (Basic/Standard/Premium). To suspend, click
**Suspend**.

### 2.6 Setting the Connected Pricing Tier

The connected pricing tier determines which pricing tier (Basic/Standard/Premium)
all member schools will use for license plans and addon billing.

1. On the group panel, click **Edit**.
2. Change **Connected license pricing tier** to Basic, Standard, or Premium
   (or leave empty to use each school's own stage).
3. Click **Save**.

When the Multi-Branch addon is active and a pricing tier is set, all new licenses
created for member schools will snapshot the **group's** pricing tier stage instead
of the school's individual stage. See [§5](#5-license-pricing-tier-connection) for
details.

### 2.7 Managing Proprietor Accounts

- **Activate/Deactivate** — click the button next to each proprietor account to
  toggle `isActive`. Deactivated accounts cannot log in.
- Proprietor accounts can be identified by their email and permission level
  (Full or View-only).

### 2.8 Deleting a Group

1. Click **Delete** on the group panel.
2. Confirm.

A group cannot be deleted if it has:
- Member schools (remove all schools first)
- Historical transfer records (these are permanent audit records)

The addon subscriptions are cleaned up automatically when the group is deleted.

---

## 3. Proprietor Console Guide

**URL:** `/proprietor` (login at `/proprietor/login`)

The Proprietor Console is a read-only oversight dashboard (with optional
transfer initiation for Full-access proprietors). Proprietors do **not** have
access to the Platform Owner Console or any school-level admin pages.

### 3.1 Logging In

1. Go to `/proprietor/login`.
2. Enter your email and password.
3. You will be redirected to `/proprietor` (the dashboard).

On first login, you will be prompted to change your password (set by the
Platform Owner during account creation).

Alternatively, from the main login page (`/login`), type "marksheet" and click
the **"Proprietor Login"** button.

### 3.2 Cross-Branch Dashboard (Overview Tab)

The **Branch Overview** tab shows a table of every branch in your group:

| Column | Description |
|--------|-------------|
| **School** | Branch name |
| **Stage** | The school's pricing tier (Basic/Standard/Premium) — may be overridden by the group's pricing tier |
| **Students** | Current active enrollment count |
| **Avg Score** | Latest current term's overall average across all students with results |
| **License** | License end date |
| **Status** | License status (Active/Grace Period/Expired/Suspended/None) + stale flag + suspended flag |

#### Stale Data Warning

If any branch's license has expired or lapsed, an amber warning banner appears
at the top:

> ⚠ License expired — data may be stale
> The following branches have expired or lapsed licenses. Their data is still
> shown but may not be current: [branch names]

This ensures you never silently view frozen numbers as if they were current.

### 3.3 Subject Comparison (Comparison Tab)

The **Subject Comparison** tab shows a side-by-side matrix:

- **Rows** = subjects (grouped by name across branches)
- **Columns** = branches
- **Cells** = the branch's average score for that subject in the current term

The highest score per row is highlighted in **green**, making it easy to spot
which branch is strongest in each subject.

If no branches have term results yet, an empty state is shown.

### 3.4 Transfer Records (Transfers Tab)

The **Transfer Records** tab lists every cross-branch student transfer in your
group, ordered by most recent:

| Column | Description |
|--------|-------------|
| **Date** | When the transfer occurred |
| **Origin School** | The branch the student came from |
| **Origin Student** | Student name + admission number at origin |
| **→** | Direction indicator |
| **Destination School** | The branch the student transferred to |
| **Destination Student** | Student name + new admission number at destination |
| **Notes** | Any transfer notes |

This is the one place where cross-branch student-level data is intentionally
surfaced — scoped strictly to your own group. The destination branch's own staff
see only that the student transferred in (a simple note), not the origin
branch's underlying academic records.

### 3.5 Permission Levels

| Capability | Full | View-Only |
|------------|------|-----------|
| View cross-branch dashboard | ✅ | ✅ |
| View subject comparisons | ✅ | ✅ |
| View transfer records | ✅ | ✅ |
| Initiate student transfers | ✅ | ❌ |

View-only accounts are ideal for delegating oversight access to an accountant
or operations manager without giving them the ability to initiate transfers.

### 3.6 Stat Cards

At the top of the dashboard, four stat cards summarize:

- **Branches** — total number of schools in the group
- **Total Students** — combined enrollment across all branches
- **Group Average** — weighted average of all branches with current-term results
- **Transfers** — total cross-branch transfers recorded

---

## 4. School Admin Guide

School Admins operate within their own school only. The Multi-Branch addon
adds one capability for School Admins at the **destination** branch: the ability
to register a student transferring in from another branch in the same group.

### 4.1 Transfer Student From Another Branch

When your school belongs to a group with the Multi-Branch addon active, the
Students page (`/students`) shows a **"Transfer from Branch"** form instead of
the CSV import form.

1. Go to **Students** (`/students`).
2. In the **Transfer from Branch** card, search for the origin student by name
   or admission number.
3. Select the student from the search results (only students from OTHER
   branches in your group appear — never from unrelated schools).
4. Optionally assign the student to a class.
5. Optionally add transfer notes.
6. Click **Transfer Student**.

What happens:
- A **new Student record** is created at your school with a fresh admission
  number (using your school's shortcode + sequence).
- The student's bio-data (name, date of birth, gender, photo, etc.) is copied
  from the origin record.
- A **Group Student Transfer Record** is created linking the origin and
  destination records.
- The origin record at the other branch is **untouched** — their historical data
  is preserved.

### 4.2 What School Admins Cannot Do

- **Cannot see other branches' data** — group membership does not give school
  admins any cross-branch visibility. That remains exclusively a Proprietor-tier
  capability.
- **Cannot search outside their group** — the student search only returns
  results from schools within the same group.
- **Cannot transfer a student out** — transfers are always initiated at the
  destination branch, never at the origin. The origin branch's admin may not
  even know a transfer has occurred (the origin record is simply left as-is).

### 4.3 Preventing Duplicate Transfers

The system prevents:
- Transferring a student from your own school (origin and destination must be
  different schools)
- Cross-group transfers (origin and destination must be in the same group)
- Duplicate transfers (the same origin student transferred to the same
  destination school twice)

---

## 5. License Fee-Group Connection

### 5.1 How It Works

Each School Group can optionally have a **connected pricing tier** (Basic,
Standard, or Premium). When set AND the Multi-Branch addon is active for the
group:

- All new licenses created for member schools will use the **group's pricing tier
  stage** instead of the school's individual `stage` field.
- The license record's `stage` field snapshots the effective (overridden) stage
  at creation time.
- A note is added to the license record: `[Stage overridden by group "XYZ Group":
  premium]`

### 5.2 Where It Applies

The pricing-tier override is applied in two places where licenses are created:

1. **Owner Console → School Detail → Update License** (`/console/schools/[id]`)
   — when the Platform Owner manually assigns a license to a school.
2. **Owner Console → Payments → Verify Payment** (`/console/payments`) — when a
   payment is verified and a license is auto-created or extended.

### 5.3 Stage-Specific Pricing

All addons (not just Multi-Branch) now have **pricing** — three
price fields instead of one:

| Field | Applies to |
|-------|-----------|
| `basicPrice` | Basic schools |
| `standardPrice` | Standard schools |
| `premiumPrice` | Premium schools |

When a school's effective stage is resolved (either its own or overridden by a
group), the corresponding price field is used. The legacy single `price` field
is kept as a fallback for backwards compatibility.

### 5.4 Resolving the Effective Stage

The `resolveEffectiveStage(schoolId)` helper (in
`src/lib/license/stage-resolver.ts`) determines the effective stage:

```
1. Look up the school's own stage (Basic/Standard/Premium).
2. Check if the school belongs to a School Group.
3. If the group has a feeGroupStage set:
   a. Check if the Multi-Branch addon is active for the group.
   b. If yes → return the group's feeGroupStage (overridden = true).
   c. If no → return the school's own stage (overridden = false).
4. If no group or no feeGroupStage → return the school's own stage.
```

### 5.5 Owner Console Addon Pricing

The Platform Owner sets prices for each addon at
`/console/addons`:

- Each addon card shows three price columns (Basic/Standard/Premium).
- Creating or editing an addon requires entering prices for each stage (leave
  empty = not sold to that stage).
- The "Multi-Branch / Group of Schools" addon is seeded with default prices:
  - Basic: ₦100,000
  - Standard: ₦150,000
  - Premium: ₦200,000

---

## 6. Addon Gating

### 6.1 School-Level Addon Check

Existing addons (Timetable Generator, Daily Attendance, Notifications, etc.)
are checked per-school using `isAddonActive(schoolId, addonName)`:

```typescript
const active = await isAddonActive(schoolId, "Timetable Generator");
```

### 6.2 Group-Level Addon Check

The Multi-Branch addon is checked at the **group level** using
`isGroupAddonActive(groupId, addonName)`:

```typescript
const active = await isGroupAddonActive(groupId, "Multi-Branch / Group of Schools");
```

This mirrors the school-level check but operates on `GroupAddonSubscription`
instead of `SchoolAddon`.

### 6.3 What Is Gated

| Feature | Gating |
|---------|--------|
| Proprietor Console access | Group-level Multi-Branch addon must be active |
| Proprietor dashboard data | Group-level Multi-Branch addon must be active |
| School-level transfer form | School must be in a group with Multi-Branch addon active |
| Transfer search action | School must be in a group with Multi-Branch addon active |
| Transfer creation action | School must be in a group with Multi-Branch addon active |

If the addon is not active:
- Proprietors see a warning: "The Multi-Branch addon is not active for your
  school group. Please contact the platform owner to activate it."
- School admins see the normal CSV import form instead of the transfer form.
- Server actions return an error if called directly.

---

## 7. Data Model Reference

### New Models

#### SchoolGroup
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `name` | String (unique) | e.g. "XYZ Group of Schools" |
| `feeGroupStage` | LicenseStageName? | Connected pricing tier (basic/standard/premium) — overrides member schools' stages when Multi-Branch addon is active |
| `createdBy` | String? | Platform Owner user ID |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

#### GroupMembership
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `groupId` | String | FK to SchoolGroup |
| `schoolId` | String (unique) | FK to School — a school can be in at most one group |
| `addedBy` | String? | Platform Owner user ID |
| `addedAt` | DateTime | |

#### GroupAddonSubscription
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `groupId` | String | FK to SchoolGroup |
| `addonId` | String | FK to Addon |
| `status` | String | active / expired / suspended |
| `startDate` | DateTime | |
| `endDate` | DateTime? | null = permanent |
| `paymentReference` | String? | |
| `setBy` | String? | Platform Owner user ID |
| `notes` | String? | |

Unique constraint: `(groupId, addonId)` — an addon can only be subscribed once
per group.

#### GroupStudentTransferRecord
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `groupId` | String | FK to SchoolGroup |
| `originSchoolId` | String | FK to School (origin branch) |
| `originStudentId` | String | FK to Student (origin record — untouched) |
| `destinationSchoolId` | String | FK to School (destination branch) |
| `destinationStudentId` | String | FK to Student (new record at destination) |
| `transferredAt` | DateTime | |
| `initiatedBy` | String? | Staff ID at destination, or Proprietor user ID |
| `notes` | String? | |

### Modified Models

#### User (new fields)
| Field | Type | Description |
|-------|------|-------------|
| `proprietorGroupId` | String? | FK to SchoolGroup — links proprietor to their group |
| `proprietorPermissionLevel` | String? | "full" or "view_only" |

#### UserRole enum
Added `proprietor` as a new role.

#### Addon (new fields)
| Field | Type | Description |
|-------|------|-------------|
| `basicPrice` | Decimal? | Price for Basic schools |
| `standardPrice` | Decimal? | Price for Standard schools |
| `premiumPrice` | Decimal? | Price for Premium schools |

Legacy `price` field retained for backwards compatibility.

#### School (new relations)
- `groupMembership` — the group this school belongs to (if any)
- `originTransfers` — transfers where this school was the origin
- `destinationTransfers` — transfers where this school was the destination

#### Student (new relations)
- `originTransfers` — transfers where this student was the origin
- `destinationTransfers` — transfers where this student was the destination

---

## Quick Reference: User Flows

### Platform Owner Flow
```
/console/login → /console → /console/groups
  → Create group
  → Add schools to group
  → Set pricing tier (Basic/Standard/Premium)
  → Create proprietor accounts (Full or View-only)
  → Activate "Multi-Branch / Group of Schools" addon
```

### Proprietor Flow
```
/proprietor/login → /proprietor
  → View branch overview (enrollment, avg, license status)
  → View subject comparison matrix
  → View transfer records
  → (Full access only) initiate transfers at destination branch
```

### School Admin Flow (Transfer)
```
/login → /students
  → "Transfer from Branch" form appears (only if group + addon active)
  → Search origin student within group
  → Select student
  → Assign class
  → Transfer → new student record created + transfer record linked
```
