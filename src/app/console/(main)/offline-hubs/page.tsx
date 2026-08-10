import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { OfflineHubsClient } from "./offline-hubs-client";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [hubs, schools] = await Promise.all([
    prisma.hub.findMany({
      orderBy: { createdAt: "desc" },
      include: { school: { select: { name: true } } },
    }),
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <OfflineHubsClient
      hubs={hubs.map((h) => ({
        id: h.id,
        name: h.name,
        schoolName: h.school.name,
        status: h.status,
        lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      }))}
      schools={schools.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}