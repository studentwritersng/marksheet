import { prisma } from "@/lib/prisma";

/**
 * Group-level addon activation check.
 * Mirrors `isAddonActive` but operates at the School Group level
 * via GroupAddonSubscription rather than per-school SchoolAddon.
 *
 * Returns true if the group has an active subscription for an addon with the given name.
 */
export async function isGroupAddonActive(groupId: string, addonName: string): Promise<boolean> {
  const sub = await prisma.groupAddonSubscription.findFirst({
    where: {
      groupId,
      status: "active",
      addon: { name: addonName, isActive: true },
    },
  });
  return sub !== null;
}
