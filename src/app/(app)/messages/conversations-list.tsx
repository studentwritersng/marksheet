"use client";

import { useState } from "react";

interface ConversationVM {
  id: string;
  subject: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  otherParticipants: { userId: string; userLabel: string; userType: string }[];
  lastReadAt: string | null;
}

export function ConversationsList({ conversations }: { conversations: ConversationVM[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = conversations.filter((c) => {
    if (filter === "unread") return c.unreadCount > 0;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && now.getDate() === d.getDate()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 font-label-sm text-label-sm ${filter === "all" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`rounded-full px-3 py-1 font-label-sm text-label-sm ${filter === "unread" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}
        >
          Unread
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">No conversations yet.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg divide-y divide-outline-variant">
          {sorted.map((c) => (
            <a
              key={c.id}
              href={`/messages/${c.id}`}
              className={`flex items-start gap-4 px-4 py-3 hover:bg-surface-container-low transition-colors ${c.unreadCount > 0 ? "bg-surface-container-low" : ""}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md shrink-0">
                {c.otherParticipants.map((p) => p.userLabel?.[0]?.toUpperCase() ?? "?").join("") || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {c.otherParticipants.map((p) => p.userLabel).join(", ")}
                  </p>
                  <span className="font-label-xs text-label-xs text-on-surface-variant shrink-0">
                    {formatDate(c.lastMessageAt)}
                  </span>
                </div>
                {c.subject && (
                  <p className="font-label-sm text-label-sm text-on-surface-variant truncate mt-0.5">
                    {c.subject}
                  </p>
                )}
                <p className={`font-body-sm text-body-sm truncate mt-1 ${c.unreadCount > 0 ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                  {c.lastMessage}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-primary text-on-primary px-2 py-0.5 font-label-sm text-label-sm">
                  {c.unreadCount}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
