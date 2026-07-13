"use client";

import { useActionState } from "react";
import Link from "next/link";
import { replyToTicketAction, updateTicketStatusAction, type ActionState } from "@/lib/tickets/actions";

const init: ActionState = {};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100/10 text-gray-400",
  medium: "bg-blue-100/10 text-blue-400",
  high: "bg-amber-100/10 text-amber-400",
  urgent: "bg-red-100/10 text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100/10 text-green-400",
  in_progress: "bg-blue-100/10 text-blue-400",
  resolved: "bg-gray-100/10 text-gray-500",
  closed: "bg-white/5 text-white/30",
};

interface TicketVM {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  schoolName: string;
  createdByEmail: string;
  assignedToEmail: string | null;
  createdAt: string;
}

interface MessageVM {
  id: string;
  content: string;
  userId: string;
  userEmail: string;
  createdAt: string;
}

export function ConsoleTicketDetailClient({
  ticket,
  messages,
  currentUserId,
}: {
  ticket: TicketVM;
  messages: MessageVM[];
  currentUserId: string;
}) {
  const [replyState, replyAction, replyPending] = useActionState(replyToTicketAction, init);

  async function handleStatusChange(newStatus: string) {
    const res = await updateTicketStatusAction(ticket.id, newStatus as any);
    if (res.error) alert(res.error);
  }

  return (
    <div className="max-w-3xl">
      <Link href="/console/tickets" className="text-sm text-blue-400 hover:underline mb-4 inline-block">&larr; Back to tickets</Link>

      <div className="bg-white/5 border border-white/10 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-lg text-white font-semibold">{ticket.title}</h1>
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-sm bg-white/5 border border-white/10 rounded p-1.5 text-white"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/40 mb-4">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
            {ticket.priority}
          </span>
          <span>{ticket.schoolName}</span>
          <span>by {ticket.createdByEmail}</span>
          {ticket.assignedToEmail && <span>Assigned: {ticket.assignedToEmail}</span>}
          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="text-sm text-white/70 whitespace-pre-wrap">{ticket.description}</div>
      </div>

      <div className="space-y-3 mb-6">
        {messages.map((m) => {
          const isOwn = m.userId === currentUserId;
          return (
            <div key={m.id} className={`border rounded-lg p-4 ${isOwn ? "bg-blue-500/10 border-blue-500/20 ml-8" : "bg-white/5 border-white/10 mr-8"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white font-semibold">{m.userEmail}</span>
                <span className="text-[11px] text-white/30">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm text-white/70 whitespace-pre-wrap">{m.content}</div>
            </div>
          );
        })}
      </div>

      <form action={replyAction} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <div>
          <label className="text-xs text-white/50 block mb-1">Reply</label>
          <textarea name="content" required rows={3}
            className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm text-white" />
        </div>
        {replyState.error && <p className="text-red-400 text-xs">{replyState.error}</p>}
        {replyState.success && <p className="text-green-400 text-xs">{replyState.success}</p>}
        <button type="submit" disabled={replyPending}
          className="bg-blue-600 text-white text-sm py-2 px-6 rounded hover:bg-blue-500 disabled:opacity-60">
          {replyPending ? "Sending..." : "Send Reply"}
        </button>
      </form>
    </div>
  );
}
