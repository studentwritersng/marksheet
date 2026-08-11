import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { HubManager } from "@/components/offline/hub-manager";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const hubs = await prisma.hub.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <HubManager
      mode="manage"
      hubs={hubs.map((h) => ({
        id: h.id,
        name: h.name,
        status: h.status,
        lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
