import { prisma } from "@/lib/prisma";
import type { LicenseStageName } from "@prisma/client";

/**
 * Resolve the effective pricing tier for a school.
 *
 * If the school belongs to a School Group that has the Multi-Branch addon
 * active AND the group has a `feeGroupStage` set, that group stage overrides
 * the school's own `stage` for license pricing purposes.
 *
 * Otherwise, the school's own `stage` is used.
 *
 * Returns the effective stage and whether it was overridden by a group.
 */
export async function resolveEffectiveStage(schoolId: string): Promise<{
  stage: LicenseStageName;
  overridden: boolean;
  groupName: string | null;
}> {
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { stage: true },
  });

  // Check if this school is in a group
  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId },
    include: { group: true },
  });

  if (membership?.group.feeGroupStage) {
    // Check if Multi-Branch addon is active for the group
    const addonActive = await prisma.groupAddonSubscription.findFirst({
      where: {
        groupId: membership.groupId,
        status: "active",
        addon: { name: "Multi-Branch / Group of Schools", isActive: true },
      },
    });

    if (addonActive) {
      return {
        stage: membership.group.feeGroupStage,
        overridden: true,
        groupName: membership.group.name,
      };
    }
  }

  return {
    stage: school.stage,
    overridden: false,
    groupName: null,
  };
}

/**
 * Get the effective price for an addon given a school's effective stage.
 * Uses the stage-specific price field that matches the resolved stage.
 */
export function getAddonPriceForStage(
  addon: { basicPrice: bigint | null; standardPrice: bigint | null; premiumPrice: bigint | null; price: bigint | null },
  stage: LicenseStageName,
): number | null {
  const stagePrice =
    stage === "basic" ? addon.basicPrice
      : stage === "standard" ? addon.standardPrice
        : stage === "premium" ? addon.premiumPrice
        : null;

  if (stagePrice !== null) return Number(stagePrice);
  // Fall back to legacy single price
  return addon.price !== null ? Number(addon.price) : null;
}
