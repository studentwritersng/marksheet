import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { GroupsClient } from "./client";

export default async function ConsoleGroupsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [groups, schools, addons] = await Promise.all([
    prisma.schoolGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: { school: { select: { id: true, name: true, stage: true, suspended: true } } },
        },
        proprietors: {
          select: { id: true, email: true, isActive: true, proprietorPermissionLevel: true },
        },
        addonSubscriptions: {
          include: { addon: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.school.findMany({
      where: { groupMembership: null }, // only schools not yet in a group
      orderBy: { name: "asc" },
      select: { id: true, name: true, stage: true },
    }),
    prisma.addon.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, basicPrice: true, standardPrice: true, premiumPrice: true },
    }),
  ]);

  return (
    <GroupsClient
      groups={groups.map((g) => ({
        id: g.id,
        name: g.name,
        feeGroupStage: g.feeGroupStage,
        createdAt: g.createdAt.toISOString(),
        memberships: g.memberships.map((m) => ({
          id: m.id,
          schoolId: m.schoolId,
          schoolName: m.school.name,
          schoolStage: m.school.stage,
          schoolSuspended: m.school.suspended,
        })),
        proprietors: g.proprietors.map((p) => ({
          id: p.id,
          email: p.email,
          isActive: p.isActive,
          permissionLevel: p.proprietorPermissionLevel,
        })),
        addonSubscriptions: g.addonSubscriptions.map((s) => ({
          id: s.id,
          addonId: s.addonId,
          addonName: s.addon.name,
          status: s.status,
        })),
      }))}
      availableSchools={schools.map((s) => ({ id: s.id, name: s.name, stage: s.stage }))}
      addons={addons.map((a) => ({
        id: a.id,
        name: a.name,
        basicPrice: a.basicPrice?.toNumber() ?? null,
        standardPrice: a.standardPrice?.toNumber() ?? null,
        premiumPrice: a.premiumPrice?.toNumber() ?? null,
      }))}
    />
  );
}
