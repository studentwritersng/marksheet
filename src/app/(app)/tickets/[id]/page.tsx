import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { TicketDetailClient } from "./client";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { email: true } },
      assignedTo: { select: { email: true } },
      messages: {
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket || ticket.schoolId !== user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Ticket not found.</p>;
  }

  return (
    <TicketDetailClient
      ticket={{
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdByEmail: ticket.createdBy.email,
        assignedToEmail: ticket.assignedTo?.email ?? null,
        createdAt: ticket.createdAt.toISOString(),
      }}
      messages={ticket.messages.map((m) => ({
        id: m.id,
        content: m.content,
        userEmail: m.user.email,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
