import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { getReportCardConfig } from "./actions";
import { ReportCardSettingsClient } from "./client";

export default async function ReportCardSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const config = await getReportCardConfig(user.schoolId);

  return (
    <div className="max-w-2xl">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Report Card Settings</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Configure what sections and columns appear on printed report cards for this school.
      </p>
      <div className="mt-6">
        <ReportCardSettingsClient config={config} />
      </div>
    </div>
  );
}
