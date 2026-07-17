import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ParentSettingsClient } from "./client";

export default async function ParentSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  const parentAccount = await prisma.parentAccount.findUnique({
    where: { email: user.email },
    select: { id: true, notificationPreferences: true, phone: true },
  });

  const initialPrefs = parentAccount?.notificationPreferences as Record<string, unknown> | null ?? {};

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Notification Preferences</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Choose how you receive updates about your ward&apos;s activities
        </p>
      </div>

      <ParentSettingsClient
        parentAccountId={parentAccount?.id ?? ""}
        initialPrefs={initialPrefs}
        phone={parentAccount?.phone ?? null}
      />
    </section>
  );
}
