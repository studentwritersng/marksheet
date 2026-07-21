import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { AddonsClient } from "./client";

export default async function ConsoleAddonsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [addons, codes] = await Promise.all([
    prisma.addon.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.addonCode.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <AddonsClient
      addons={addons.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        features: a.features as string[] | null,
        basicPrice: a.basicPrice?.toNumber() ?? null,
        standardPrice: a.standardPrice?.toNumber() ?? null,
        premiumPrice: a.premiumPrice?.toNumber() ?? null,
        price: a.price?.toNumber() ?? null,
        durationDays: a.durationDays,
        isActive: a.isActive,
      }))}
      codes={codes.map((c) => ({
        id: c.id,
        code: c.code,
        schoolId: c.schoolId,
        isUsed: c.isUsed,
        usedBySchoolId: c.usedBySchoolId,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
