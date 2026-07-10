import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { PaymentMethodsClient } from "./client";

export default async function PaymentMethodsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const methods = await prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <PaymentMethodsClient
      methods={methods.map((m) => ({
        id: m.id,
        type: m.type,
        label: m.label,
        isActive: m.isActive,
        details: m.details as Record<string, string> | null,
      }))}
    />
  );
}
