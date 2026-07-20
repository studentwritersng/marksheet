import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { getGroupDashboardData } from "@/lib/addons/group-dashboard";
import { ProprietorDashboardClient } from "./dashboard-client";

export default async function ProprietorDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  const groupId = user.proprietorGroupId;
  const addonActive = await isGroupAddonActive(groupId, "Multi-Branch / Group of Schools");

  if (!addonActive) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">School Group</h1>
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm mt-4">
          The Multi-Branch addon is not active for your school group. Please contact the platform owner to activate it.
        </div>
      </div>
    );
  }

  const data = await getGroupDashboardData(groupId);

  return (
    <ProprietorDashboardClient
      data={data}
      permissionLevel={user.proprietorPermissionLevel ?? "view_only"}
    />
  );
}
