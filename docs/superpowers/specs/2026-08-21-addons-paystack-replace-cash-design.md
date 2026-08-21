# Addons Payment: Replace Cash with Paystack — Design

**Date:** 2026-08-21
**Status:** Implemented and verified

## Problem

The client dashboard addons page (`src/app/(app)/addons`) showed a "code" activation
tab plus a Purchase tab listing only **Bank Transfer** and **Cash Payment** — no
Paystack option, despite the Paystack integration having been built into every
payment flow.

## Root cause

Payment methods are data-driven. The addons page dropdown is populated from the
`payment_methods` table (`isActive = true`), and selecting a method of type
`online` triggers the existing Paystack flow (`createPaystackCharge` → redirect →
`/paystack/callback` → `/api/paystack/verify` → addon auto-activates).

The Neon database contained only two active methods — `bank_transfer` ("Bank Transfer")
and `cash` ("Cash Payment") — and no `online` method. Separately,
`PAYSTACK_SECRET_KEY` in `.env` is empty (owner adds keys later), so charges cannot
initialize until it is set.

## Decisions (approved by user)

- **Deactivate** (not delete) the cash method — reversible from `/console/payment-methods`.
- Apply to the **Neon DB only** (the `DATABASE_URL` the app uses); local dev DB untouched.
- Set up everything now; owner pastes Paystack test keys into `.env` afterward.
- Bank Transfer method left untouched.

## Change (data-only; no application code modified)

Via a one-off script against Neon:

1. `UPDATE payment_methods SET "isActive" = false WHERE type = 'cash'` — 1 row.
2. Insert active method: `type = 'online'`, `label = 'Paystack'`,
   `details = {"provider": "Paystack"}` (public key added later via console when keys arrive).

## Verification

Post-change query confirmed final state:

| Label | Type | Active |
|---|---|---|
| Bank Transfer | bank_transfer | true |
| Cash Payment | cash | **false** |
| Paystack | online | **true** |

Behaviour after change (existing code, unchanged):

- Addons Purchase tab dropdown now shows Bank Transfer + Paystack; Cash is gone
  (also hidden from billing pages, which read the same table).
- Selecting Paystack shows the redirect notice, button reads "Pay with Paystack",
  and `purchaseAddonAction` redirects to the Paystack checkout.
- Until `PAYSTACK_SECRET_KEY` is set, clicking it returns "Paystack is not configured." — expected.

## Follow-up for owner

- Paste `sk_test_...` into `PAYSTACK_SECRET_KEY` in `.env` (and add public key in
  console payment method details if desired) to make Paystack fully live.
- Temp scripts used for the change were deleted; nothing else was modified.
