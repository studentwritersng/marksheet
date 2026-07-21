import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { getGroupDashboardData } from "@/lib/addons/group-dashboard";
import { AnalyticsClient } from "./analytics-client";

export default async function ProprietorAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  const groupId = user.proprietorGroupId;
  const addonActive = await isGroupAddonActive(groupId, "Multi-Branch / Group of Schools");

  if (!addonActive) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Multi-Branch addon is not active. Activate it on the{" "}
          <a href="/proprietor/billing" className="underline font-semibold">Billing</a> page.
        </div>
      </div>
    );
  }

  const data = await getGroupDashboardData(groupId);

  return <AnalyticsClient data={data} />;
}
