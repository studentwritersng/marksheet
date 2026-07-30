"use client";

import { useState, useRef, useEffect } from "react";
import { sendMessageAction, type MessageVM } from "./actions";

export function ConversationView({ conversationId, initialMessages }: { conversationId: string; initialMessages: MessageVM[] }) {
  const [messages, setMessages] = useState<MessageVM[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setError("");
    const res = await sendMessageAction(conversationId, content);
    if ("error" in res) {
      setError(res.error || "Failed to send message.");
      setSending(false);
    } else {
      setMessages((prev) => [...prev, res.message as MessageVM]);
      setContent("");
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-8">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
              m.isMine
                ? "bg-primary text-on-primary rounded-br-none"
                : "bg-surface-container text-on-surface rounded-bl-none"
            }`}>
              <p className="font-body-sm text-body-sm whitespace-pre-wrap">{m.content}</p>
              <p className={`font-label-xs text-label-xs mt-1 ${m.isMine ? "text-on-primary/70" : "text-on-surface-variant"}`}>
                {formatTime(m.createdAt)}
                {!m.isRead && !m.isMine && <span className="ml-1">· unread</span>}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-outline-variant bg-surface-container-low p-3">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={1}
            placeholder="Type a message..."
            className="flex-1 border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
          />
          <button type="submit" disabled={sending || !content.trim()}
            className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366] disabled:opacity-60">
            {sending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
