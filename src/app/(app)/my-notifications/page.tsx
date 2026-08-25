import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NotificationsInbox } from "./client";

export default async function NotificationsInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Notifications</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Your in-app notifications, in full.
        </p>
      </div>
      <NotificationsInbox />
    </section>
  );
}
