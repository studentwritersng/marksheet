"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/actions";

export interface ActionState {
  error?: string;
  success?: string;
}

export interface MessageVM {
  id: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

/** List conversations for the current user, ordered by most recent message. */
export async function getMyConversationsAction() {
  const user = await getCurrentUser();
  if (!user || !user.userId) return [];

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: user.userId },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          participants: true,
        },
      },
    },
  });

  // Fetch user labels for participants
  const allUserIds = participants.flatMap((p) => p.conversation.participants.map((cp) => cp.userId));
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, email: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return participants.map((p) => {
    const lastMsg = p.conversation.messages[0];
    const otherParticipants = p.conversation.participants.filter((cp) => cp.userId !== user.userId);
    return {
      id: p.conversation.id,
      subject: p.conversation.subject,
      lastMessage: lastMsg?.content ?? "",
      lastMessageAt: lastMsg?.createdAt.toISOString() ?? p.conversation.createdAt.toISOString(),
      unreadCount: p.conversation.messages.filter((m) => !m.isRead && m.senderId !== user.userId).length,
      otherParticipants: otherParticipants.map((cp) => ({
        userId: cp.userId,
        userLabel: userMap.get(cp.userId)?.email ?? cp.userLabel ?? "Unknown",
        userType: cp.userType,
      })),
      lastReadAt: p.lastReadAt?.toISOString() ?? null,
    };
  });
}

/** Get messages in a conversation. */
export async function getConversationMessagesAction(conversationId: string) {
  const user = await getCurrentUser();
  if (!user || !user.userId) return { error: "Not authenticated." } as const;

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: user.userId },
  });
  if (!participant) return { error: "Not a participant." } as const;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  // Mark as read
  await prisma.message.updateMany({
    where: { conversationId, isRead: false, senderId: { not: user.userId } },
    data: { isRead: true },
  });
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  revalidatePath("/messages");

  return { messages: messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
    isMine: m.senderId === user.userId,
  })) };
}

/** Send a message in a conversation. */
export async function sendMessageAction(conversationId: string, content: string) {
  const user = await getCurrentUser();
  if (!user || !user.userId) return { error: "Not authenticated." } as const;
  if (!content.trim()) return { error: "Message cannot be empty." } as const;

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: user.userId },
  });
  if (!participant) return { error: "Not a participant." } as const;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.userId,
      content: content.trim(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Notify other participants
  const otherParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: user.userId } },
  });
  for (const op of otherParticipants) {
    await createNotification({
      schoolId: participant.conversationId,
      recipientType: op.userType as "staff" | "student" | "parent",
      recipientId: op.userId,
      channel: "in_app",
      eventType: "new_message",
      title: `New message${participant.userLabel ? ` from ${participant.userLabel}` : ""}`,
      content: content.trim().slice(0, 200),
    });
  }

  await recordAudit({
    schoolId: user.schoolId ?? undefined,
    actorId: user.userId,
    action: "create",
    entityType: "message",
    entityId: message.id,
    afterValue: { conversationId } as never,
  });

  revalidatePath(`/messages/${conversationId}`);
  return { message: {
    id: message.id,
    senderId: message.senderId,
    content: message.content,
    isRead: message.isRead,
    createdAt: message.createdAt.toISOString(),
    isMine: true,
  } };
}

/** Create a new conversation with a recipient. */
export async function createConversationAction(recipientId: string, subject: string, initialMessage: string) {
  const user = await getCurrentUser();
  if (!user || !user.userId) return { error: "Not authenticated." } as const;
  if (!user.schoolId) return { error: "No school context." } as const;
  if (!recipientId || !initialMessage.trim()) return { error: "Recipient and message are required." } as const;

  // Verify recipient exists in same school
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, schoolId: user.schoolId },
    select: { id: true, role: true, email: true, staffId: true },
  });
  if (!recipient) return { error: "Recipient not found in your school." } as const;

  // Determine user types
  const senderType = user.role === "staff" ? "staff" : user.role === "parent" ? "parent" : "student" as const;
  const recipientType = recipient.role === "staff" ? "staff" : recipient.role === "parent" ? "parent" : "student" as const;

  const conversation = await prisma.conversation.create({
    data: {
      schoolId: user.schoolId,
      subject: subject.trim() || null,
      participants: {
        create: [
          { userId: user.userId, userType: senderType, userLabel: user.email },
          { userId: recipient.id, userType: recipientType, userLabel: recipient.email },
        ],
      },
      messages: {
        create: { senderId: user.userId, content: initialMessage.trim() },
      },
    },
    include: { participants: true },
  });

  // Notify recipient
  await createNotification({
    schoolId: user.schoolId,
    recipientType,
    recipientId: recipient.id,
    channel: "in_app",
    eventType: "new_message",
    title: `New message from ${user.email}`,
    content: initialMessage.trim().slice(0, 200),
  });

  await recordAudit({
    schoolId: user.schoolId,
    actorId: user.userId,
    action: "create",
    entityType: "conversation",
    entityId: conversation.id,
    afterValue: { recipientId, subject } as never,
  });

  revalidatePath("/messages");
  return { conversationId: conversation.id };
}

/** Search eligible recipients for messaging based on current user role. */
export async function searchRecipientsAction(query: string) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { recipients: [] };

  const q = query.toLowerCase();
  let results: { userId: string; label: string; type: string }[] = [];

  if (user.role === "staff") {
    const staff = await prisma.user.findMany({
      where: {
        schoolId: user.schoolId,
        role: "staff",
        id: { not: user.userId },
        OR: [
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, staffId: true },
      take: 20,
    });
    results = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  } else if (user.role === "parent") {
    const guardian = await prisma.guardian.findFirst({
      where: { parentUserId: user.userId },
      include: { student: { select: { schoolId: true } } },
    });
    const schoolId = guardian?.student?.schoolId;
    if (!schoolId) return { recipients: [] };

    const staff = await prisma.user.findMany({
      where: {
        schoolId,
        role: "staff",
        OR: [
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, staffId: true },
      take: 20,
    });
    results = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  }

  return { recipients: results };
}

/** Get eligible recipients for messaging based on current user role. */
export async function getMessageRecipientsAction() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authenticated." } as const;

  let recipients: { userId: string; label: string; type: string }[] = [];

  if (user.role === "staff") {
    // Staff can message other staff
    const staff = await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: "staff", id: { not: user.userId } },
      select: { id: true, email: true, staffId: true },
    });
    recipients = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  } else if (user.role === "parent") {
    // Parents can message staff (admins, teachers) of their school
    const guardian = await prisma.guardian.findFirst({
      where: { parentUserId: user.userId },
      include: { student: { select: { schoolId: true } } },
    });
    const schoolId = guardian?.student?.schoolId;
    if (!schoolId) return { error: "No school found." } as const;

    const staff = await prisma.user.findMany({
      where: { schoolId, role: "staff" },
      select: { id: true, email: true, staffId: true },
    });
    recipients = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  }

  return { recipients };
}
