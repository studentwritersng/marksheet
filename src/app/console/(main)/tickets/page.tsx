import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ConsoleTicketsClient } from "./client";

export default async function ConsoleTicketsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const tickets = await prisma.ticket.findMany({
    include: {
      school: { select: { name: true } },
      createdBy: { select: { email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Support Tickets</h1>
      <p className="text-sm text-white/50 mb-6">Manage tickets from all schools.</p>
      <ConsoleTicketsClient
        tickets={tickets.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          schoolName: t.school.name,
          messageCount: t._count.messages,
          createdByEmail: t.createdBy.email,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
