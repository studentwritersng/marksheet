"use client";

import { useActionState } from "react";
import Link from "next/link";
import { replyToTicketAction, updateTicketStatusAction, type ActionState } from "@/lib/tickets/actions";

const init: ActionState = {};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-gray-100 text-gray-500",
  closed: "bg-surface-variant text-on-surface-variant",
};

interface TicketVM {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdByEmail: string;
  assignedToEmail: string | null;
  createdAt: string;
}

interface MessageVM {
  id: string;
  content: string;
  userEmail: string;
  createdAt: string;
}

export function TicketDetailClient({ ticket, messages }: { ticket: TicketVM; messages: MessageVM[] }) {
  const [replyState, replyAction, replyPending] = useActionState(replyToTicketAction, init);

  async function handleStatusChange(newStatus: string) {
    const res = await updateTicketStatusAction(ticket.id, newStatus as any);
    if (res.error) alert(res.error);
  }

  return (
    <div className="max-w-3xl">
      <Link href="/tickets" className="text-sm text-primary hover:underline mb-4 inline-block">&larr; Back to tickets</Link>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold">{ticket.title}</h1>
          <div className="flex gap-2 shrink-0">
            {["open", "in_progress", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`text-[11px] px-2 py-1 rounded-full font-medium ${
                  ticket.status === s ? STATUS_COLORS[s] : "bg-surface-variant text-on-surface-variant"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mb-4">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
            {ticket.priority}
          </span>
          {ticket.category && <span>Category: {ticket.category}</span>}
          <span>Created by: {ticket.createdByEmail}</span>
          {ticket.assignedToEmail && <span>Assigned to: {ticket.assignedToEmail}</span>}
          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{ticket.description}</div>
      </div>

      <div className="space-y-3 mb-6">
        {messages.map((m) => (
          <div key={m.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">{m.userEmail}</span>
              <span className="text-[11px] text-on-surface-variant">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      <form action={replyAction} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 space-y-3">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Reply</label>
          <textarea name="content" required rows={3} className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
        </div>
        {replyState.error && <p className="text-red-600 font-body-sm text-body-sm">{replyState.error}</p>}
        {replyState.success && <p className="text-green-700 font-body-sm text-body-sm">{replyState.success}</p>}
        <button type="submit" disabled={replyPending}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60">
          {replyPending ? "Sending..." : "Send Reply"}
        </button>
      </form>
    </div>
  );
}
