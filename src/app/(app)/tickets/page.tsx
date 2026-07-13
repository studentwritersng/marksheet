import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { TicketsClient } from "./tickets-client";

export default async function TicketsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.schoolId) return <p className="font-body-sm text-body-sm text-on-surface-variant">Not available.</p>;

  const tickets = await prisma.ticket.findMany({
    where: { schoolId: user.schoolId },
    include: {
      createdBy: { select: { email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Support Tickets</h1>
      <p className="mt-1 mb-6 font-body-sm text-body-sm text-on-surface-variant">Submit and track support requests.</p>
      <TicketsClient
        tickets={tickets.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          messageCount: t._count.messages,
          createdByEmail: t.createdBy.email,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
