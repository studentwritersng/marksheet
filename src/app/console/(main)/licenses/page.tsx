import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { LicensesClient } from "./client";

export default async function ConsoleLicensesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [plans, licenses] = await Promise.all([
    prisma.licensePlan.findMany({ orderBy: { name: "asc" }, include: { stages: { orderBy: { sortOrder: "asc" } } } }),
    prisma.schoolLicense.findMany({
      orderBy: [{ status: "asc" }, { endDate: "desc" }],
      include: { school: { select: { name: true } }, plan: { select: { name: true, durationType: true } }, stage: { select: { name: true } } },
    }),
  ]);

  return (
    <LicensesClient
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        durationType: p.durationType,
        price: p.price?.toNumber(),
        durationDays: p.durationDays,
        isActive: p.isActive,
        stages: p.stages.map((s) => ({ id: s.id, name: s.name, price: s.price?.toNumber(), criteria: s.criteria as Record<string, number> | null, sortOrder: s.sortOrder })),
      }))}
      licenses={licenses.map((l) => ({
        id: l.id,
        schoolName: l.school.name,
        planName: l.plan.name,
        stageName: l.stage?.name ?? null,
        durationType: l.plan.durationType,
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        status: l.status,
        autoRenewIntent: l.autoRenewIntent,
        paymentReference: l.paymentReference,
        setBy: l.setBy,
      }))}
    />
  );
}
