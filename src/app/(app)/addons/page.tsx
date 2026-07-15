import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { AddonsClient } from "./client";

export default async function AddonsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.schoolId) {
    if (user.role === "platform_owner") redirect("/console");
    redirect("/dashboard");
  }

  const [addons, schoolAddons, methods] = await Promise.all([
    prisma.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.schoolAddon.findMany({ where: { schoolId: user.schoolId } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <AddonsClient
      addons={addons.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        features: a.features as string[] | null,
        price: a.price?.toNumber(),
        durationDays: a.durationDays,
        isActive: a.isActive,
      }))}
      activeAddons={schoolAddons.map((sa) => ({
        addonId: sa.addonId,
        status: sa.status,
        activatedVia: sa.activatedVia,
        expiresAt: sa.expiresAt?.toISOString() ?? null,
      }))}
      methods={methods.map((m) => ({ id: m.id, type: m.type, label: m.label, details: m.details as Record<string, string> | null }))}
    />
  );
}
