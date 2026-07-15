import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { SchoolDetailClient } from "./client";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const school = await prisma.school.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      motto: true,
      shortcode: true,
      maintenanceMode: true,
      suspended: true,
      stageId: true,
      createdAt: true,
      _count: { select: { students: true, staff: true, sessions: true, subjects: true } },
    },
  });

  if (!school) notFound();

  const [licenses, plans, planStages] = await Promise.all([
    prisma.schoolLicense.findMany({
      where: { schoolId: id },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true, durationType: true } } },
    }),
    prisma.licensePlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.planStage.findMany({
      include: { plan: { select: { name: true, durationType: true } } },
      orderBy: [{ plan: { name: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  return (
    <SchoolDetailClient
      school={{
        ...school,
        createdAt: school.createdAt.toISOString(),
      }}
      licenses={licenses.map((l) => ({
        id: l.id,
        planName: l.plan.name,
        durationType: l.plan.durationType,
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        status: l.status,
        paymentReference: l.paymentReference,
        notes: l.notes,
        autoRenewIntent: l.autoRenewIntent,
        setBy: l.setBy,
        createdAt: l.createdAt.toISOString(),
      }))}
      plans={plans.map((p) => ({ id: p.id, name: p.name, durationType: p.durationType }))}
      planStages={planStages.map((ps) => ({ id: ps.id, name: ps.name, price: ps.price?.toNumber(), planName: ps.plan.name, durationType: ps.plan.durationType }))}
    />
  );
}
