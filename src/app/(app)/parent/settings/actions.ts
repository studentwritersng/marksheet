"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

interface ActionState { error?: string; success?: string }

export async function updateParentNotificationPrefsAction(
  parentAccountId: string,
  prefs: { smsActive: boolean; whatsappActive: boolean; enabledEvents: string[] },
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "parent") return { error: "Not authorised." };

    await prisma.parentAccount.update({
      where: { id: parentAccountId },
      data: { notificationPreferences: prefs },
    });

    revalidatePath("/parent/settings");
    return { success: "Notification preferences saved." };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
