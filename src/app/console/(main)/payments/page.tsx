import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { PaymentsClient } from "./client";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      school: { select: { name: true } },
      plan: { select: { name: true } },
      paymentMethod: { select: { label: true, type: true } },
    },
  });

  return (
    <PaymentsClient
      payments={payments.map((p) => ({
        id: p.id,
        schoolName: p.school.name,
        planName: p.plan.name,
        amount: p.amount.toNumber(),
        methodLabel: p.paymentMethod.label,
        methodType: p.paymentMethod.type,
        reference: p.reference,
        proofUrl: p.proofUrl,
        notes: p.notes,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
