import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { DemoRequestsClient } from "./client";

export default async function ConsoleDemoRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const { status } = await searchParams;
  const valid = ["new", "contacted", "qualified", "converted", "closed"];
  const filter = status && valid.includes(status) ? status : undefined;

  const requests = await prisma.demoRequest.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.demoRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Demo Requests</h1>
      <p className="text-sm text-white/50 mb-6">Sales leads from the marketing homepage. Manage them here.</p>

      <DemoRequestsClient
        requests={requests.map((r) => ({
          id: r.id,
          contactName: r.contactName,
          schoolName: r.schoolName,
          phone: r.phone,
          email: r.email,
          studentCountRange: r.studentCountRange,
          message: r.message,
          status: r.status,
          source: r.source,
          createdAt: r.createdAt.toISOString(),
        }))}
        counts={{
          total: requests.length,
          new: countMap["new"] ?? 0,
          contacted: countMap["contacted"] ?? 0,
          qualified: countMap["qualified"] ?? 0,
          converted: countMap["converted"] ?? 0,
          closed: countMap["closed"] ?? 0,
        }}
        currentStatus={filter ?? "all"}
      />
    </div>
  );
}
