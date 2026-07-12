import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { SchoolsPageClient } from "./schools-page-client";

export default async function ConsoleSchoolsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      shortcode: true,
      maintenanceMode: true,
      createdAt: true,
      _count: { select: { students: true, staff: true, sessions: true } },
      licenses: {
        orderBy: { endDate: "desc" },
        take: 1,
        select: { status: true, endDate: true, plan: { select: { name: true } } },
      },
    },
  });

  const now = Date.now();

  return (
    <SchoolsPageClient
      now={now}
      schools={schools.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
        shortcode: s.shortcode,
        maintenanceMode: s.maintenanceMode,
        createdAt: s.createdAt.toISOString(),
        studentCount: s._count.students,
        staffCount: s._count.staff,
        sessionCount: s._count.sessions,
        licenseStatus: s.licenses[0]?.status ?? null,
        licenseEndDate: s.licenses[0]?.endDate?.toISOString() ?? null,
        licensePlanName: s.licenses[0]?.plan?.name ?? null,
      }))}
    />
  );
}
