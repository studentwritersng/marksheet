import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ReferralsClient } from "./referrals-client";

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [referrals, registrations, commissions] = await Promise.all([
    prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { schools: true, schoolRegistrations: true, commissions: true },
        },
      },
    }),
    prisma.schoolRegistration.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referral: { select: { fullName: true, referralCode: true } },
        paymentMethod: { select: { label: true } },
      },
    }),
    prisma.referralCommission.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referral: { select: { fullName: true, referralCode: true, email: true } },
        registration: { select: { schoolName: true } },
      },
    }),
  ]);

  return (
    <ReferralsClient
      referrals={referrals.map((r) => ({
        ...r,
        dateOfBirth: r.dateOfBirth.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      registrations={registrations.map((r) => ({
        ...r,
        registrationFee: r.registrationFee ? Number(r.registrationFee) : null,
        paymentMethodLabel: r.paymentMethod?.label ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      commissions={commissions.map((c) => ({
        ...c,
        amount: Number(c.amount),
        createdAt: c.createdAt.toISOString(),
        paidAt: c.paidAt?.toISOString() || null,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
