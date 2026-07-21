import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BillingClient } from "./client";

export default async function ProprietorBillingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <BillingClient groupId={user.proprietorGroupId} />
    </div>
  );
}
