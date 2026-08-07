# 13 — Roles & Consoles

This document covers the three elevated areas of the platform beyond the standard school app: the **Platform Owner console**, the **Proprietor console**, and the **Referral portal**.

## 1. The four access tiers (summary)

| Tier | Role(s) | URL | Guard | What it manages |
|---|---|---|---|---|
| School app | `staff`, `student`, `parent`, `super_admin`-in-school | `/dashboard`, `/exams`, ... | `(app)/layout.tsx` | Everything inside one school |
| **Platform Owner console** | `platform_owner` | `/console/*` | `console/(main)/layout.tsx` | All schools, licensing, payments, addons, curriculum, AI, referral program |
| **Proprietor console** | `proprietor` | `/proprietor/*` | `proprietor/(console)/layout.tsx` (+ forced password change) | A group of branch schools (Multi-Branch addon) |
| Referral portal | `referral` | `/referral/*` | per-page guards | Own referrals, commissions, payouts |

Platform roles (`platform_owner`, `proprietor`, `referral`, `super_admin`) have `schoolId = null` on their `User` row. They are resolved via `src/lib/auth/platform-owner.ts` (`requirePlatformOwner`, `requireProprietor`).

## 2. Platform Owner console — `/console/*`

Layout: `src/app/console/(main)/layout.tsx` — **platform_owner only**; any other role → `/dashboard`. Login at `/console/login` (no seeded owner).

| Route | Purpose |
|---|---|
| `/console` | Platform-wide KPIs dashboard |
| `/console/schools` | Manage all schools (CRUD, review) |
| `/console/schools/[id]` | Single school detail (billing, license, stage) |
| `/console/schools/[id]/backup` | Backup/restore for a school |
| `/console/licenses` | Manage school licenses |
| `/console/payments` | Payment transactions |
| `/console/payment-methods` | Configure payment channels |
| `/console/referrals` | Referral program management |
| `/console/referral-settings` | Commission config (registration fee, %) |
| `/console/groups` | School groups (multi-branch) |
| `/console/tickets` · `/console/tickets/[id]` | Support tickets platform-wide |
| `/console/notifications` | Publish platform notifications |
| `/console/landing-stats` | Edit landing-page hero stats |
| `/console/addons` | Manage addons/activation |
| `/console/nerdc-upload` | Upload NERDC curriculum datasets |
| `/console/curriculum` | Central curriculum management |
| `/console/audit` | Platform-wide audit log |
| `/console/demo-requests` | Onboarding/demo lead list |
| `/console/ai` · `/console/ai/call-log` | AI providers + call telemetry |

**Common pattern:** console pages are server components that call `requirePlatformOwner()`, query platform-wide (no school scope), and mutate via console actions in `src/app/console/(main)/<area>/actions.ts`.

### Creating the first platform owner
No seed creates one. Use a one-off script (as in `DEPLOY.md` §11) or the `super_admin` account to create a `platform_owner` user. Example with Prisma + bcrypt:

```ts
const hash = await bcrypt.hash("your-strong-password", 12);
await prisma.user.create({
  data: { email: "owner@myportal.sch.ng", passwordHash: hash, role: "platform_owner", isActive: true },
});
```

## 3. Proprietor console — `/proprietor/*`

For owners of a **group of schools** (Multi-Branch addon). Layout: `src/app/proprietor/(console)/layout.tsx` — requires `proprietor` role, and forces `/proprietor/change-password` when `mustChangePassword` is set.

| Route | Purpose |
|---|---|
| `/proprietor` | Multi-branch dashboard (addon-gated) |
| `/proprietor/analytics` | Group-wide analytics |
| `/proprietor/billing` | Group billing across branches |
| `/proprietor/branches` | Manage branch schools |
| `/proprietor/branches/[id]` | Single branch detail |
| `/proprietor/transfers` | Student transfers between branches |
| `/proprietor/settings` | Group settings |

**Key model:** `SchoolGroup` + `GroupMembership` (schools in the group). `User.proprietorGroupId` links the owner; `proprietorPermissionLevel` = `full` | `view_only`.

Group logic lives in `src/lib/addons/group-*.ts`. Group addons use `GroupAddonSubscription` (not `SchoolAddon`).

## 4. Referral portal — `/referral/*`

| Route | Purpose |
|---|---|
| `/referral` | Public program landing + agent signup |
| `/referral/login` · `/referral/logout` | Agent auth |
| `/referral/dashboard` | Referrals, commissions, payouts |

**Key model:** `Referral` (agent profile, unique referral code, commission bank details, own `passwordHash`) — also mirrored as a `User` with role `referral`.

**Commission flow:**
1. Global config: `ReferralCommissionSetting` (registration fee + commission %).
2. School signs up via `/register` (optionally with a referral code).
3. `SchoolRegistration` created; on activation, `ReferralCommission` recorded (`pending`).
4. Console (`/console/referrals`, `/console/referral-settings`) pays/rejects.

## 5. super_admin

The `super_admin` role (seeded: `super@marksheet.dev`) can act inside any school (`canManageSchool` returns true), sees `/schools` in the school app, and generally has platform-level reach. `platform_owner` also passes `isSuperAdmin` checks in `resolvePermissions`.

## 6. Gotchas

- **Never** expose a platform-level action without `requirePlatformOwner()`/`requireProprietor()` — they are distinct roles with distinct scopes.
- Proprietor console is **addon-gated**: guard with the Multi-Branch addon check before rendering the dashboard.
- Keep `proprietorPermissionLevel` respected (`view_only` should block mutations).
- Platform console actions still `recordAudit()` — use `actorId: user.userId`.