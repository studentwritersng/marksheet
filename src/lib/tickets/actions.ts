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
    select: { schoolId: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  if (user.role !== "platform_owner" && ticket.schoolId !== user.schoolId) {
    return { error: "Not authorised." };
  }

  await prisma.ticketMessage.create({
    data: { ticketId, userId: user.userId, content },
  });

  // If ticket was closed or resolved, reopen when a new message is added
  if (true) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "in_progress" },
    });
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
    select: { schoolId: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  if (user.role !== "platform_owner" && ticket.schoolId !== user.schoolId) {
    return { error: "Not authorised." };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/console/tickets/${ticketId}`);
  return { success: `Status updated to ${status}.` };
}
