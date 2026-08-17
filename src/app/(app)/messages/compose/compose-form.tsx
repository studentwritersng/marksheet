"use client";

import { useState } from "react";
import { getMessageRecipientsAction, createConversationAction } from "../actions";

export function ComposeMessageForm({ recipients }: { recipients: { userId: string; label: string; type: string }[] }) {
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">To</label>
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
          <option value="">Select recipient</option>
          {recipients.map((r) => (
            <option key={r.userId} value={r.userId}>
              {r.label} {r.type === "parent" ? "(Parent)" : "(Staff)"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject (optional)</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          placeholder="What is this about?" />
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Message</label>
        <textarea value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} required rows={5}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md"
          placeholder="Write your message..." />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={sending}
        className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
