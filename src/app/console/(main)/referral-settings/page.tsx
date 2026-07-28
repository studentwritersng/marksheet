import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ReferralSettingsClient } from "./referral-settings-client";

export default async function ReferralSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const setting = await prisma.referralCommissionSetting.findFirst();

  return (
    <ReferralSettingsClient
      registrationFee={setting ? Number(setting.registrationFee) : 10000}
      commissionPercent={setting ? Number(setting.commissionPercent) : 10}
    />
  );
}
