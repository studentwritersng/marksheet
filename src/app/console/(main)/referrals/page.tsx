import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ReferralsClient } from "./referrals-client";

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const [referrals, registrations] = await Promise.all([
    prisma.referral.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { schools: true, schoolRegistrations: true },
        },
      },
    }),
    prisma.schoolRegistration.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referral: {
          select: { fullName: true, referralCode: true },
        },
      },
    }),
  ]);

  const referralData = referrals.map((r) => ({
    ...r,
    dateOfBirth: r.dateOfBirth.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const registrationData = registrations.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <ReferralsClient referrals={referralData} registrations={registrationData} />
  );
}
