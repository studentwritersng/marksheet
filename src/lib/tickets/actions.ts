"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface ActionState {
  error?: string;
  success?: string;
}

async function guardUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  return user;
}

async function notifyPlatformOwner(title: string, content: string, schoolName?: string) {
  const owners = await prisma.user.findMany({
    where: { role: "platform_owner", isActive: true },
    select: { id: true },
  });
  const prefix = schoolName ? `[${schoolName}] ` : "";
  await Promise.all(owners.map((o) =>
    prisma.notification.create({
      data: {
        recipientType: "staff",
        recipientId: o.id,
        channel: "in_app",
        eventType: "ticket",
        title: `${prefix}${title}`,
        content,
      },
    })
  ));
}

async function notifyUser(userId: string, title: string, content: string) {
  await prisma.notification.create({
    data: {
      recipientType: "staff",
      recipientId: userId,
      channel: "in_app",
      eventType: "ticket",
      title,
      content,
    },
  });
}

export async function createTicketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let user;
  try { user = await guardUser(); } catch (e: any) { return { error: e.message }; }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = (formData.get("priority") as string) || "medium";
  const category = (formData.get("category") as string) || null;

  if (!title || !description) return { error: "Title and description are required." };

  const schoolId = user.schoolId;
  if (!schoolId) return { error: "No school association." };

  await prisma.ticket.create({
    data: {
      schoolId,
      title,
      description,
      priority: priority as any,
      category,
      createdById: user.userId,
    },
  });

  // Fetch school name for the notification
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  await notifyPlatformOwner(
    `New Ticket: ${title}`,
    `Priority: ${priority}${category ? ` | Category: ${category}` : ""}`,
    school?.name,
  );

  revalidatePath("/tickets");
  return { success: "Ticket created." };
}

export async function replyToTicketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let user;
  try { user = await guardUser(); } catch (e: any) { return { error: e.message }; }

  const ticketId = formData.get("ticketId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!ticketId || !content) return { error: "Missing ticket ID or content." };

  // Verify access to the ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { schoolId: true, title: true, createdById: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  if (user.role !== "platform_owner" && ticket.schoolId !== user.schoolId) {
    return { error: "Not authorised." };
  }

  await prisma.ticketMessage.create({
    data: { ticketId, userId: user.userId, content },
  });

  // Reopen ticket when a new message is added
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "in_progress" },
  });

  // Notify the other party
  if (user.role === "platform_owner") {
    // Platform owner replied — notify the ticket creator
    await notifyUser(ticket.createdById, `Reply: ${ticket.title}`, content);
  } else {
    // School user replied — notify platform owners
    const school = await prisma.school.findUnique({
      where: { id: ticket.schoolId },
      select: { name: true },
    });
    await notifyPlatformOwner(
      `Reply: ${ticket.title}`,
      content,
      school?.name,
    );
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/console/tickets/${ticketId}`);
  return { success: "Reply sent." };
}

export async function updateTicketStatusAction(
  ticketId: string,
  status: "open" | "in_progress" | "resolved" | "closed",
): Promise<ActionState> {
  let user;
  try { user = await guardUser(); } catch (e: any) { return { error: e.message }; }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { schoolId: true, title: true, createdById: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  if (user.role !== "platform_owner" && ticket.schoolId !== user.schoolId) {
    return { error: "Not authorised." };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status },
  });

  // Notify ticket creator when platform owner changes status
  if (user.role === "platform_owner") {
    await notifyUser(
      ticket.createdById,
      `Ticket ${status.replace("_", " ")}: ${ticket.title}`,
      `Status changed to ${status.replace("_", " ")}.`,
    );
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/console/tickets/${ticketId}`);
  return { success: `Status updated to ${status}.` };
}
