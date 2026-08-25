"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/actions";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { isMessagingStaffRole, participantTypeForRole } from "@/lib/messages/roles";
import {
  searchDirectory, countAudience, resolveAudienceUserIds, BULK_SEND_CAP,
  type AudienceSpec, type DirectoryQuery, type DirectoryEntry,
} from "@/lib/messages/audience";

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

  // Mark as read. NOTE: no revalidatePath here — this function is awaited
  // during a Server Component render (/messages/[id]), and revalidating during
  // render throws. The list page refetches naturally on navigation.
  await prisma.message.updateMany({
    where: { conversationId, isRead: false, senderId: { not: user.userId } },
    data: { isRead: true },
  });
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

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
      schoolId: user.schoolId ?? undefined,
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
  const senderType = participantTypeForRole(user.role);
  const recipientType = participantTypeForRole(recipient.role);

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

  if (isMessagingStaffRole(user.role)) {
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
  } else if (user.role === "student" && user.schoolId) {
    // Students may contact staff of their own school.
    const staff = await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: "staff" },
      select: { id: true, email: true, staffId: true },
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

  if (isMessagingStaffRole(user.role)) {
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
  } else if (user.role === "student" && user.schoolId) {
    // Students may contact staff of their own school.
    const staff = await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: "staff" },
      select: { id: true, email: true, staffId: true },
    });
    recipients = staff.map((u) => ({ userId: u.id, label: u.email, type: "staff" as const }));
  }

  return { recipients };
}

async function canBulkSend(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Promise<boolean> {
  if (!user.schoolId) return false;
  // Top-level school owners are always allowed.
  if (user.role === "super_admin" || user.role === "platform_owner" || user.role === "proprietor") return true;
  const perms = await resolvePermissions(user);
  // school-admin (staff with school_admin assignment) or HOD (staff with hod assignment).
  return canManageSchool(perms) || perms.assignments.some((a) => a.type === "hod");
}

/** Directory feed for the individual composer picker. */
export async function searchDirectoryAction(input: DirectoryQuery): Promise<DirectoryEntry[]> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return [];
  return searchDirectory(user.schoolId, input);
}

/** Live preview count for the bulk composer. */
export async function countAudienceAction(spec: AudienceSpec): Promise<{ count: number }> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { count: 0 };
  return { count: await countAudience(user.schoolId, spec, user.userId) };
}

/** Bulk-send a private 1:1 conversation to every member of an audience. */
export async function bulkSendAction(
  spec: AudienceSpec,
  subject: string,
  body: string,
): Promise<{ sent?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !user.userId || !user.schoolId) return { error: "Not authenticated." };
  if (!(await canBulkSend(user))) return { error: "Not allowed." };
  if (!body.trim()) return { error: "Message cannot be empty." };

  const userIds = await resolveAudienceUserIds(user.schoolId, spec, user.userId);
  if (userIds.length === 0) return { error: "No recipients match this audience." };
  if (userIds.length > BULK_SEND_CAP) {
    return { error: `Too many recipients (${userIds.length}). Cap is ${BULK_SEND_CAP}. Narrow the filters.` };
  }

  const senderType = participantTypeForRole(user.role);
  let sent = 0;

  for (let i = 0; i < userIds.length; i += 20) {
    await Promise.all(userIds.slice(i, i + 20).map(async (recipientId) => {
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true, role: true, schoolId: true },
      });
      if (!recipient || recipient.schoolId !== user.schoolId) return;
      await prisma.conversation.create({
        data: {
          schoolId: user.schoolId!,
          subject: subject.trim() || null,
          participants: {
            create: [
              { userId: user.userId, userType: senderType, userLabel: user.email },
              { userId: recipient.id, userType: participantTypeForRole(recipient.role), userLabel: recipient.email },
            ],
          },
          messages: { create: { senderId: user.userId, content: body.trim() } },
        },
      });
      await createNotification({
        schoolId: user.schoolId!,
        recipientType: participantTypeForRole(recipient.role),
        recipientId: recipient.id,
        channel: "in_app",
        eventType: "new_message",
        title: `New message from ${user.email}`,
        content: body.trim().slice(0, 200),
      });
      sent += 1;
    }));
  }

  await recordAudit({
    schoolId: user.schoolId,
    actorId: user.userId,
    action: "create",
    entityType: "conversation_bulk",
    entityId: `bulk:${Date.now()}`,
    afterValue: { spec, sent } as never,
  });

  revalidatePath("/messages");
  return { sent };
}
