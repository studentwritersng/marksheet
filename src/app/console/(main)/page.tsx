import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { ConsoleDashboardClient } from "./dashboard-client";

export default async function ConsoleDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    schools,
    totalLicenses,
    activeLicensesCount,
    graceLicensesCount,
    expiredLicensesCount,
    expiringSoonCount,
    plans,
    payments,
    totalStudents,
    totalStaff,
    openTicketsCount,
    totalTicketsCount,
  ] = await Promise.all([
    prisma.school.findMany({
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
        _count: { select: { students: true, staff: true } },
        licenses: {
          where: { status: { in: ["active", "grace_period"] } },
          orderBy: { endDate: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            endDate: true,
            plan: { select: { name: true } },
          },
        },
      },
    }),
    prisma.schoolLicense.count(),
    prisma.schoolLicense.count({ where: { status: "active" } }),
    prisma.schoolLicense.count({ where: { status: "grace_period" } }),
    prisma.schoolLicense.count({ where: { status: "expired" } }),
    prisma.schoolLicense.count({
      where: { status: "active", endDate: { lte: thirtyDaysFromNow, gte: now } },
    }),
    prisma.licensePlan.findMany({ orderBy: { name: "asc" } }),
    prisma.payment.findMany({
      where: { status: "verified" },
      select: { amount: true },
    }),
    prisma.student.count(),
    prisma.staff.count(),
    prisma.ticket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.ticket.count(),
  ]);

  // Convert decimal to plain number to prevent Next.js serialization issues
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <ConsoleDashboardClient
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
        licenseStatus: s.licenses[0]?.status ?? null,
        licenseEndDate: s.licenses[0]?.endDate?.toISOString() ?? null,
        licensePlanName: s.licenses[0]?.plan?.name ?? null,
      }))}
      activeLicensesCount={activeLicensesCount}
      graceLicensesCount={graceLicensesCount}
      expiredLicensesCount={expiredLicensesCount}
      expiringSoonCount={expiringSoonCount}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        durationType: p.durationType,
      }))}
      totalStudents={totalStudents}
      totalStaff={totalStaff}
      totalRevenue={totalRevenue}
      openTicketsCount={openTicketsCount}
      totalTicketsCount={totalTicketsCount}
    />
  );
}
