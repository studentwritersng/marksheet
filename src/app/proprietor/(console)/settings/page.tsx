import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function ProprietorSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  const group = await prisma.schoolGroup.findUnique({
    where: { id: user.proprietorGroupId },
    select: {
      id: true,
      name: true,
      feeGroupStage: true,
      createdAt: true,
      memberships: {
        include: {
          school: {
            select: { id: true, name: true, stage: true },
          },
        },
      },
    },
  });

  if (!group) {
    redirect("/proprietor/login");
  }

  return (
    <SettingsClient
      group={{
        id: group.id,
        name: group.name,
        feeGroupStage: group.feeGroupStage,
        createdAt: group.createdAt.toISOString(),
        branches: group.memberships.map((m) => ({
          id: m.school.id,
          name: m.school.name,
          stage: m.school.stage,
        })),
      }}
      userEmail={user.email}
      permissionLevel={user.proprietorPermissionLevel ?? "view_only"}
    />
  );
}
