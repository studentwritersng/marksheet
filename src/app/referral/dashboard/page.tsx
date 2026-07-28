import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ReferralDashboardClient } from "./dashboard-client";

export default async function ReferralDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "referral") redirect("/referral/login");

  const referral = await prisma.referral.findUnique({
    where: { email: user.email },
    include: {
      schools: {
        select: { id: true, name: true, createdAt: true },
      },
      schoolRegistrations: {
        select: { id: true, schoolName: true, status: true, createdAt: true, paymentStatus: true },
        orderBy: { createdAt: "desc" },
      },
      commissions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!referral) redirect("/referral/login");

  const totalCommissions = referral.commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const paidCommissions = referral.commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const pendingCommissions = referral.commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <ReferralDashboardClient
      referral={{
        id: referral.id,
        fullName: referral.fullName,
        email: referral.email,
        referralCode: referral.referralCode,
        phoneNumber: referral.phoneNumber,
        whatsappNumber: referral.whatsappNumber,
        bankName: referral.bankName,
        bankAccountNumber: referral.bankAccountNumber,
        bankAccountName: referral.bankAccountName,
      }}
      stats={{
        totalReferrals: referral.schools.length,
        pendingRegistrations: referral.schoolRegistrations.filter((r) => r.status === "pending").length,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
      }}
      schools={referral.schools.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))}
      registrations={referral.schoolRegistrations.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))}
      commissions={referral.commissions.map((c) => ({
        ...c,
        amount: Number(c.amount),
        createdAt: c.createdAt.toISOString(),
        paidAt: c.paidAt?.toISOString() || null,
      }))}
    />
  );
}
