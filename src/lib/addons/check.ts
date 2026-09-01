import { prisma } from "@/lib/prisma";

export async function isAddonActive(schoolId: string, addonName: string): Promise<boolean> {
  // Check the school's own addon subscription first
  const count = await prisma.schoolAddon.count({
    where: { schoolId, status: "active", addon: { name: addonName, isActive: true } },
  });
  if (count > 0) return true;

  // Fall back: if this school is in a group with useSingleLicense, any active
  // group-level addon subscription for the same addon name covers this school.
  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId },
    include: { group: { select: { useSingleLicense: true, id: true } } },
  });
  if (membership?.group.useSingleLicense) {
    const groupSub = await prisma.groupAddonSubscription.findFirst({
      where: {
        groupId: membership.group.id,
        status: "active",
        addon: { name: addonName, isActive: true },
      },
    });
    return groupSub !== null;
  }

  return false;
}
