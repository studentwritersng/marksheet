import { prisma } from "@/lib/prisma";

export async function isAddonActive(schoolId: string, addonName: string): Promise<boolean> {
  const count = await prisma.schoolAddon.count({
    where: { schoolId, status: "active", addon: { name: addonName, isActive: true } },
  });
  return count > 0;
}
