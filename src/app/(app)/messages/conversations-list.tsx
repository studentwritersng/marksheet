"use client";

import { useState } from "react";
import { ConversationView } from "./conversation-view";
import { createConversationAction } from "./actions";

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
  const [composing, setComposing] = useState(false);

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
        <button
          onClick={() => setComposing(true)}
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          New Message
        </button>
      </div>

      {/* Compose form inline */}
      {composing && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">New Message</h3>
            <button onClick={() => setComposing(false)} className="text-on-surface-variant hover:text-on-surface text-lg">&times;</button>
          </div>
          <ComposeInline onSent={() => setComposing(false)} />
        </div>
      )}

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

function ComposeInline({ onSent }: { onSent: () => void }) {
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recipients, setRecipients] = useState<{ userId: string; label: string; type: string }[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  async function searchRecipients(query: string) {
    setSearch(query);
    if (query.length < 2) { setRecipients([]); setShowDropdown(false); return; }
    setSearching(true);
    const res = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setRecipients(data.recipients || []);
    setShowDropdown(true);
    setSearching(false);
  }

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!recipientId || !initialMessage.trim()) return;
      setSending(true);
      setError("");
      const res = await createConversationAction(recipientId, subject, initialMessage);
      if ("error" in res) {
        setError(res.error || "Failed to send message.");
        setSending(false);
      } else {
        window.location.href = `/messages/${res.conversationId}`;
      }
    }} className="space-y-3">
      <div className="relative">
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">To</label>
        <input
          type="text"
          value={search}
          onChange={(e) => searchRecipients(e.target.value)}
          placeholder="Search staff or parents..."
          className="w-full border border-outline-variant rounded p-2.5 font-body-sm text-body-sm"
          required
        />
        {showDropdown && recipients.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-outline-variant rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {recipients.map((r) => (
              <button
                key={r.userId}
                type="button"
                onClick={() => { setRecipientId(r.userId); setSearch(r.label); setShowDropdown(false); }}
                className="w-full text-left px-3 py-2 hover:bg-surface-container-low font-body-sm text-body-sm"
              >
                {r.label} <span className="text-on-surface-variant text-xs">({r.type})</span>
              </button>
            ))}
          </div>
        )}
        {searching && <p className="text-xs text-on-surface-variant mt-1">Searching...</p>}
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject (optional)</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-outline-variant rounded p-2.5 font-body-sm text-body-sm"
          placeholder="What is this about?" />
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Message</label>
        <textarea value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} required rows={4}
          className="w-full border border-outline-variant rounded p-2.5 font-body-sm text-body-sm"
          placeholder="Write your message..." />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onSent} disabled={sending}
          className="px-4 py-2 text-sm border border-outline-variant rounded hover:bg-surface-container-low">Cancel</button>
        <button type="submit" disabled={sending || !recipientId}
          className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-container disabled:opacity-60">
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
