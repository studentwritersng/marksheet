import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { LicensesClient } from "./client";

export default async function ConsoleLicensesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [plans, licenses] = await Promise.all([
    prisma.licensePlan.findMany({ orderBy: { name: "asc" } }),
    prisma.schoolLicense.findMany({
      orderBy: [{ status: "asc" }, { endDate: "desc" }],
      include: { school: { select: { name: true } }, plan: { select: { name: true, durationType: true } } },
    }),
  ]);

  return (
    <LicensesClient
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        durationType: p.durationType,
        price: p.price?.toNumber(),
        basicPrice: p.basicPrice?.toNumber(),
        standardPrice: p.standardPrice?.toNumber(),
        premiumPrice: p.premiumPrice?.toNumber(),
        durationDays: p.durationDays,
        isActive: p.isActive,
      }))}
      licenses={licenses.map((l) => ({
        id: l.id,
        schoolName: l.school.name,
        planName: l.plan.name,
        stageName: l.stage ?? null,
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
