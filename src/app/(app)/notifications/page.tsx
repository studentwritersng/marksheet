import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { isAddonActive } from "@/lib/addons/check";
import { NotificationsClient } from "./client";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const schoolId = user.schoolId;
  const isPlatformOwner = user.role === "super_admin" || user.role === "platform_owner";

  const addonActive = await isAddonActive(schoolId, "Notifications (WhatsApp & SMS)");

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Notifications</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          WhatsApp and SMS notification service for guardians
        </p>
      </div>

      {!addonActive && (
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Notifications (WhatsApp & SMS) addon is not active for your school. Enable it on the{" "}
          <a href="/addons" className="underline font-semibold">Addons</a> page.
        </div>
      )}

      {addonActive && (
        <NotificationsClient
          schoolId={schoolId}
          isPlatformOwner={isPlatformOwner}
        />
      )}
    </section>
  );
}
