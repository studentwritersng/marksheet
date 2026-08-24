"use client";

import { useState } from "react";
import Link from "next/link";

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
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = conversations.filter((c) => {
    if (filter === "unread") return c.unreadCount > 0;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.otherParticipants.some((p) => p.userLabel.toLowerCase().includes(query)) ||
        (c.subject && c.subject.toLowerCase().includes(query)) ||
        c.lastMessage.toLowerCase().includes(query)
      );
    }
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
      {/* Header with compose button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 font-label-sm text-label-sm ${filter === "all" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3 py-1 font-label-sm text-label-sm ${filter === "unread" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            Unread
          </button>
        </div>
        <Link
          href="/messages/compose"
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          New Message
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Conversations list */}
      {sorted.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-2">chat</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {searchQuery ? "No conversations match your search." : "No conversations yet. Start a new message!"}
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg divide-y divide-outline-variant">
          {sorted.map((c) => (
            <a
              key={c.id}
              href={`/messages/${c.id}`}
              className={`flex items-start gap-4 px-4 py-3.5 hover:bg-surface-container-low transition-colors ${c.unreadCount > 0 ? "bg-surface-container-low" : ""}`}
            >
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md shrink-0">
                {c.otherParticipants.map((p) => p.userLabel?.[0]?.toUpperCase() ?? "?").join("") || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-label-md text-label-md truncate ${c.unreadCount > 0 ? "text-on-surface font-semibold" : "text-on-surface"}`}>
                    {c.otherParticipants.map((p) => p.userLabel).join(", ")}
                  </p>
                  <span className="font-label-xs text-label-xs text-on-surface-variant shrink-0">
                    {formatDate(c.lastMessageAt)}
                  </span>
                </div>
                {c.subject && (
                  <p className="font-label-sm text-label-sm text-primary truncate mt-0.5">
                    {c.subject}
                  </p>
                )}
                <p className={`font-body-sm text-body-sm truncate mt-1 ${c.unreadCount > 0 ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                  {c.lastMessage}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-primary text-on-primary px-2.5 py-1 font-label-sm text-label-sm font-medium">
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
