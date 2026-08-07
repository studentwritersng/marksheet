# 10 — Licensing, Addons & Billing

## 1. Concepts

Marksheet monetises through a **staged licensing** model plus **addons**.

- **License** = the school's subscription to the core platform, at a stage.
- **Stage** = `basic` · `standard` · `premium`. Stage multiplies the base price (basic ×0.7, standard ×1, premium ×1.5).
- **Addons** = optional extra products activated per school (or per group): Timetable Generator, Period Tracker, Daily Attendance, Notifications, Multi-Branch / Group of Schools.
- **Payment methods** = `bank_transfer` · `cash` · `online`.
- **Referral** = agents earn commission on referred school registrations.

## 2. Models involved

| Model | Role |
|---|---|
| `LicensePlan` | Billing plan (monthly/termly) with stage prices |
| `SchoolLicense` | The license a school currently holds (status lifecycle) |
| `Addon` | Addon catalogue with stage pricing |
| `SchoolAddon` | An activated addon on a school (status, expiry, source) |
| `GroupAddonSubscription` | A group-level (not per-school) addon subscription |
| `PaymentMethod` | Configured channels (bank/cash/online) with provider details |
| `CashCode` | One-time cash redemption codes |
| `Payment` | Purchase records with verification workflow |
| `School.stage` | The school's current stage (`basic`/`standard`/`premium`) |

## 3. Enums

| Enum | Values |
|---|---|
| `LicenseDurationType` | `monthly`, `termly` |
| `LicenseStageName` | `basic`, `standard`, `premium` |
| `LicenseStatus` | `active`, `grace_period`, `expired`, `suspended` |
| `PaymentMethodType` | `bank_transfer`, `cash`, `online` |

## 4. Stage pricing

Stage resolution lives in `src/lib/license/stage-resolver.ts`. Seeds in `prisma/seed.ts` apply multipliers over base prices:

- basic = base × **0.7**
- standard = base × **1.0**
- premium = base × **1.5**

Billing logic (progressive/staged) lives in `src/lib/billing/progressive.ts`.

## 5. Enforcement in code

### 5.1 Core license
Server actions call `guardActiveLicense(schoolId)` (`src/lib/license.ts`) after the auth guard:

```ts
try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
```
If the school has no `active` (or `grace_period`) license behind a paid feature, the action is blocked with a friendly error. The `school-license-banner` component surfaces expiry to users.

### 5.2 Addon gating
`src/lib/addons/check.ts`:

```ts
export async function isAddonActive(schoolId: string, addonName: string): Promise<boolean> {
  const count = await prisma.schoolAddon.count({
    where: { schoolId, status: "active", addon: { name: addonName, isActive: true } },
  });
  return count > 0;
}
```

Group-level gating in `src/lib/addons/group-check.ts` (for the Multi-Branch addon), plus `group-dashboard.ts` and `branch-data.ts` for the proprietor console.

## 5. Console management

Platform Owner console routes for the commercial layer:

- `/console/licenses` — manage school licenses
- `/console/payments` — payment transactions
- `/console/payment-methods` — configure channels
- `/console/addons` — manage addons / activation
- `/console/referrals` + `/console/referral-settings` — referral program + commission config

School side: `/billing` (billing & license), `/addons` (activation), `/fee-status`.

## 6. Referral commission flow

1. `ReferralCommissionSetting` defines the global registration fee + commission %.
2. An agent's `Referral` profile has a unique referral code.
3. A `SchoolRegistration` carries the referral; `ReferralCommission` records `pending`/`paid`/`rejected` commission.
4. Console settings validate the commission and registration fee before enabling.

See [13-roles-consoles.md](./13-roles-consoles.md) for the referral portal details.

## 7. Cash codes & verification

- `CashCode` — one-time redemption codes for cash payments (avoids manual matching on bank transfers).
- `Payment` has a verification workflow (school pays, platform owner verifies, license activates).

## 8. Gotchas

- Always run `guardActiveLicense(ctx.schoolId)` **after** the auth guard and **before** creating/modifying paid resources.
- Addon checks are by **addon name** (`isAddonActive(schoolId, "Timetable Generator")`), so keep names stable across environments (they're seeded).
- Group addons use `GroupAddonSubscription`, not `SchoolAddon` — use `group-check.ts` helpers in the proprietor console.
- Stage pricing is data-driven (seeded); changes are applied by re-running `npm run db:seed` (upsert).