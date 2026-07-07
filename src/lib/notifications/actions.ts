"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email/send";

// ---------------------------------------------------------------------------
// Create notification (in-app + optionally email)
// ---------------------------------------------------------------------------

export interface CreateNotificationInput {
  schoolId?: string | null;
  recipientType: "parent" | "staff";
  recipientId: string;
  recipientEmail?: string;
  eventType: string;
  title?: string;
  content: string;
  channel?: "in_app" | "email" | "push" | "sms";
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const channel = input.channel ?? "in_app";

  await prisma.notification.create({
    data: {
      schoolId: input.schoolId ?? null,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel,
      eventType: input.eventType,
      title: input.title ?? null,
      content: input.content,
    },
  });

  if (channel === "email" && input.recipientEmail) {
    await sendEmail({
      to: input.recipientEmail,
      subject: input.title ?? input.eventType,
      text: input.content,
    });
  }
}

// ---------------------------------------------------------------------------
// Mark a notification as read
// ---------------------------------------------------------------------------

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Mark all notifications as read (bulk)
// ---------------------------------------------------------------------------

export async function markAllReadAction(): Promise<{ count: number }> {
  const user = await getCurrentUser();
  if (!user) return { count: 0 };

  const result = await prisma.notification.updateMany({
    where: {
      recipientType: user.role === "parent" ? "parent" : "staff",
      recipientId: user.role === "parent" ? user.userId : user.staffId ?? user.userId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/");
  return { count: result.count };
}

// ---------------------------------------------------------------------------
// Fetch recent notifications for the current user
// ---------------------------------------------------------------------------

export interface NotificationVM {
  id: string;
  title: string | null;
  content: string;
  eventType: string;
  isRead: boolean;
  sentAt: Date;
}

export async function getMyNotifications(limit = 20): Promise<NotificationVM[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const recipientId = user.role === "parent" ? user.userId : user.staffId ?? user.userId;
  const recipientType = user.role === "parent" ? "parent" : "staff";

  const rows = await prisma.notification.findMany({
    where: { recipientType, recipientId },
    orderBy: { sentAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    eventType: r.eventType,
    isRead: r.isRead,
    sentAt: r.sentAt,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const recipientId = user.role === "parent" ? user.userId : user.staffId ?? user.userId;
  const recipientType = user.role === "parent" ? "parent" : "staff";

  return prisma.notification.count({
    where: { recipientType, recipientId, isRead: false },
  });
}
