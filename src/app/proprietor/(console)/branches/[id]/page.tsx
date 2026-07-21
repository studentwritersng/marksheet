import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { getDeepBranchData } from "@/lib/addons/branch-data";
import { BranchDetailClient } from "./branch-detail-client";

export default async function ProprietorBranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  const { id: schoolId } = await params;
  const groupId = user.proprietorGroupId;

  const addonActive = await isGroupAddonActive(groupId, "Multi-Branch / Group of Schools");
  if (!addonActive) {
    redirect("/proprietor/billing");
  }

  const data = await getDeepBranchData(groupId, schoolId);
  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <p className="text-white/40 text-sm">This school is not in your group.</p>
      </div>
    );
  }

  return <BranchDetailClient data={data} />;
}
