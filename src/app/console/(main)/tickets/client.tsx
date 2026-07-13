"use client";

import Link from "next/link";

interface TicketVM {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  schoolName: string;
  messageCount: number;
  createdByEmail: string;
  updatedAt: string;
}

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

export function ConsoleTicketsClient({ tickets }: { tickets: TicketVM[] }) {
  return (
    <div className="space-y-2">
      {tickets.map((t) => (
        <Link
          key={t.id}
          href={`/console/tickets/${t.id}`}
          className="block bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm text-white font-semibold truncate">{t.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[t.priority]}`}>
                  {t.priority}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/40">
                <span>{t.schoolName}</span>
                <span>{t.createdByEmail}</span>
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
        <p className="text-sm text-white/30 py-8 text-center">No tickets yet.</p>
      )}
    </div>
  );
}
