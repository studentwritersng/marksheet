/**
 * Progressive group billing calculator.
 *
 * When an addon has `isGroupBilling = true`, the price scales based on
 * the number of schools in the group:
 *
 *   1 school  → base price (no discount)
 *   2 schools → base × 2, minus 10%
 *   3 schools → base × 3, minus 15%
 *   4 schools → base × 4, minus 20%
 *   5+ schools→ base × N, minus 25%
 */

const DISCOUNT_TIERS: { min: number; discount: number }[] = [
  { min: 5, discount: 0.25 },
  { min: 4, discount: 0.20 },
  { min: 3, discount: 0.15 },
  { min: 2, discount: 0.10 },
  { min: 1, discount: 0 },
];

export function getGroupDiscount(schoolCount: number): number {
  for (const tier of DISCOUNT_TIERS) {
    if (schoolCount >= tier.min) return tier.discount;
  }
  return 0;
}

export function calculateGroupPrice(
  basePrice: number,
  schoolCount: number,
): { basePrice: number; schoolCount: number; discount: number; subtotal: number; total: number } {
  const discount = getGroupDiscount(schoolCount);
  const subtotal = basePrice * schoolCount;
  const total = Math.round(subtotal * (1 - discount));
  return { basePrice, schoolCount, discount, subtotal, total };
}
