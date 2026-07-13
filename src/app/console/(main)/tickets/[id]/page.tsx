import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ConsoleTicketDetailClient } from "./client";

export default async function ConsoleTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      school: { select: { name: true } },
      createdBy: { select: { email: true } },
      assignedTo: { select: { email: true } },
      messages: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return <p className="text-sm text-white/50">Ticket not found.</p>;
  }

  return (
    <ConsoleTicketDetailClient
      ticket={{
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        schoolName: ticket.school.name,
        createdByEmail: ticket.createdBy.email,
        assignedToEmail: ticket.assignedTo?.email ?? null,
        createdAt: ticket.createdAt.toISOString(),
      }}
      messages={ticket.messages.map((m) => ({
        id: m.id,
        content: m.content,
        userId: m.user.id,
        userEmail: m.user.email,
        createdAt: m.createdAt.toISOString(),
      }))}
      currentUserId={user.userId}
    />
  );
}
