"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email/send";

export async function notifyStudents(classId: string, eventType: string, title: string, content: string, schoolId?: string): Promise<void> {
  const students = await prisma.student.findMany({
    where: { currentClassId: classId, userId: { not: null } },
    select: { id: true, userId: true },
  });
  await Promise.all(students.map((s) =>
    createNotification({
      schoolId,
      recipientType: "student",
      recipientId: s.userId!,
      eventType,
      title,
      content,
    })
  ));
}

// ---------------------------------------------------------------------------
// Create notification (in-app + optionally email)
// ---------------------------------------------------------------------------

export interface CreateNotificationInput {
  schoolId?: string | null;
  recipientType: "student" | "parent" | "staff";
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

  const nt = user.role === "parent" ? "parent" : user.role === "student" ? "student" : "staff";
  const nid = user.role === "student" ? user.userId : user.role === "parent" ? user.userId : user.staffId ?? user.userId;

  const result = await prisma.notification.updateMany({
    where: {
      recipientType: nt,
      recipientId: nid,
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

  const nt2 = user.role === "parent" ? "parent" : user.role === "student" ? "student" : "staff";
  const nid2 = user.role === "student" ? user.userId : user.role === "parent" ? user.userId : user.staffId ?? user.userId;

  const rows = await prisma.notification.findMany({
    where: { recipientType: nt2, recipientId: nid2 },
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

  const nt3 = user.role === "parent" ? "parent" : user.role === "student" ? "student" : "staff";
  const nid3 = user.role === "student" ? user.userId : user.role === "parent" ? user.userId : user.staffId ?? user.userId;

  return prisma.notification.count({
    where: { recipientType: nt3, recipientId: nid3, isRead: false },
  });
}
