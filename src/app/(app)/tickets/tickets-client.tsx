"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { createTicketAction, type ActionState } from "@/lib/tickets/actions";

interface TicketVM {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  messageCount: number;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

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

export function TicketsClient({ tickets }: { tickets: TicketVM[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, action, pending] = useActionState(createTicketAction, init);
  const [priority, setPriority] = useState("medium");

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
      >
        {showForm ? "Cancel" : "New Ticket"}
      </button>

      {showForm && (
        <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">New Support Ticket</h3>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Title</label>
            <input name="title" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Description</label>
            <textarea name="description" required rows={5} className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Priority</label>
              <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Category (optional)</label>
              <select name="category" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
                <option value="">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="feature_request">Feature Request</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
          {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}
          <button type="submit" disabled={pending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60">
            {pending ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/tickets/${t.id}`}
            className="block bg-surface-container-lowest border border-outline-variant rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-label-md text-label-md text-on-surface font-semibold truncate">{t.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[t.priority]}`}>
                    {t.priority}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[t.status]}`}>
                    {t.status.replace("_", " ")}
                  </span>
                  {t.category && <span>{t.category}</span>}
                  <span>{t.messageCount} message(s)</span>
                  <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {tickets.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">No tickets yet.</p>
        )}
      </div>
    </div>
  );
}
