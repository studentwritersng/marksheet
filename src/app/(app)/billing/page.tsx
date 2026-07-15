import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { BillingClient } from "./client";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.schoolId) {
    if (user.role === "platform_owner") redirect("/console");
    redirect("/dashboard");
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, stageId: true, stage: { select: { id: true, name: true, price: true, plan: { select: { name: true, durationType: true } } } } },
  });
  if (!school) redirect("/dashboard");

  const [plans, methods, payments, currentLicense] = await Promise.all([
    prisma.licensePlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.payment.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } }, paymentMethod: { select: { label: true } } },
    }),
    prisma.schoolLicense.findFirst({
      where: { schoolId: user.schoolId, status: { in: ["active", "grace_period"] } },
      orderBy: { endDate: "desc" },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  return (
    <BillingClient
      schoolName={school.name}
      schoolStage={school.stage ? { name: school.stage.name, price: school.stage.price?.toNumber(), planName: school.stage.plan.name } : null}
      plans={plans.map((p) => ({ id: p.id, name: p.name, durationType: p.durationType, price: p.price?.toNumber(), durationDays: p.durationDays }))}
      methods={methods.map((m) => ({ id: m.id, type: m.type, label: m.label, details: m.details as Record<string, string> | null }))}
      payments={payments.map((p) => ({ id: p.id, planName: p.plan.name, amount: p.amount.toNumber(), methodLabel: p.paymentMethod.label, status: p.status, createdAt: p.createdAt.toISOString() }))}
      license={currentLicense ? { status: currentLicense.status, endDate: currentLicense.endDate.toISOString(), planName: currentLicense.plan.name } : null}
    />
  );
}
