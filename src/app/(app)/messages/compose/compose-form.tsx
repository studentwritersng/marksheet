"use client";

import { useEffect, useRef, useState } from "react";
import { createConversationAction, searchDirectoryAction, countAudienceAction, bulkSendAction } from "../actions";
import type { AudienceSpec, AudienceType, DirectoryEntry, FeeStatusValue } from "@/lib/messages/audience";

interface Props {
  recipients: { userId: string; label: string; type: string }[];
  useDirectory: boolean;
  classes: { id: string; name: string }[];
}

const FEE_OPTIONS: { value: FeeStatusValue; label: string }[] = [
  { value: "not_cleared", label: "Not cleared" },
  { value: "partial", label: "Partially cleared" },
  { value: "cleared", label: "Cleared" },
];

const AUDIENCES: { value: AudienceType; label: string; needsClass: boolean }[] = [
  { value: "teachers", label: "All teachers", needsClass: false },
  { value: "students", label: "All students", needsClass: true },
  { value: "parents", label: "All parents", needsClass: true },
  { value: "parents_by_fee", label: "Parents by fee status", needsClass: true },
];

export function ComposeMessageForm({ recipients, useDirectory, classes }: Props) {
  const [mode, setMode] = useState<"individual" | "bulk">("individual");

  // Individual
  const [dirType, setDirType] = useState<"teacher" | "student" | "parent">("teacher");
  const [classId, setClassId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  // Legacy select for non-admin senders
  const [legacyRecipientId, setLegacyRecipientId] = useState("");

  // Bulk
  const [audienceType, setAudienceType] = useState<AudienceType>("teachers");
  const [feeStatuses, setFeeStatuses] = useState<FeeStatusValue[]>(["not_cleared"]);
  const [bulkCount, setBulkCount] = useState<number | null>(null);

  // Shared
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!useDirectory || mode !== "individual") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = setTimeout(async () => {
      try {
        setResults(await searchDirectoryAction({ type: dirType, classId: classId || undefined, query }));
      } catch {
        setResults([]);
      }
    }, 250);
    debounceRef.current = t;
    return () => clearTimeout(t);
  }, [useDirectory, mode, dirType, classId, query]);

  useEffect(() => {
    if (mode !== "bulk") { setBulkCount(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const spec: AudienceSpec = {
      audienceType,
      ...(classId ? { classId } : {}),
      ...(audienceType === "parents_by_fee" ? { feeStatuses } : {}),
    };
    const valid = audienceType !== "parents_by_fee" || feeStatuses.length > 0;
    if (!valid) { setBulkCount(0); return; }
    const t = setTimeout(async () => {
      try {
        const r = await countAudienceAction(spec);
        setBulkCount(r.count);
      } catch { setBulkCount(null); }
    }, 300);
    debounceRef.current = t;
    return () => clearTimeout(t);
  }, [mode, audienceType, feeStatuses, classId]);

  async function submitIndividual(e: React.FormEvent) {
    e.preventDefault();
    const recipientId = useDirectory ? selected?.id : legacyRecipientId;
    if (!recipientId || !initialMessage.trim()) return;
    setSending(true); setError("");
    const res = await createConversationAction(recipientId, subject, initialMessage);
    if ("error" in res && res.error) { setError(res.error); setSending(false); }
    else if ("conversationId" in res) window.location.href = `/messages/${res.conversationId}`;
  }

  async function submitBulk() {
    if (!initialMessage.trim()) return;
    const count = bulkCount ?? 0;
    if (count === 0) { setError("No recipients match this audience."); return; }
    if (!window.confirm(`Send this message to ${count} recipient${count === 1 ? "" : "s"} as private conversations?`)) return;
    setSending(true); setError("");
    const spec: AudienceSpec = {
      audienceType,
      ...(classId ? { classId } : {}),
      ...(audienceType === "parents_by_fee" ? { feeStatuses } : {}),
    };
    const res = await bulkSendAction(spec, subject, initialMessage);
    setSending(false);
    if (res.error) setError(res.error);
    else setSentCount(res.sent ?? 0);
  }

  if (sentCount !== null) {
    return (
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 text-center space-y-2">
        <p className="font-headline-sm text-headline-sm text-on-surface">Sent to {sentCount} recipient{sentCount === 1 ? "" : "s"}.</p>
        <a href="/messages" className="font-label-md text-label-md text-primary hover:underline">Back to Messages</a>
      </div>
    );
  }

  return (
    <form onSubmit={submitIndividual} className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
      {useDirectory && (
        <div className="flex gap-2">
          {(["individual", "bulk"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded font-label-md text-label-md ${mode === m ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
              {m === "individual" ? "Individual" : "Bulk"}
            </button>
          ))}
        </div>
      )}

      {mode === "individual" && !useDirectory && (
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">To</label>
          <select value={legacyRecipientId} onChange={(e) => setLegacyRecipientId(e.target.value)} required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
            <option value="">Select recipient</option>
            {recipients.map((r) => (
              <option key={r.userId} value={r.userId}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      {mode === "individual" && useDirectory && (
        <>
          <div className="flex gap-2 flex-wrap">
            {([["teacher", "Teacher"], ["student", "Student"], ["parent", "Parent"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setDirType(v); setSelected(null); }}
                className={`px-3 py-1.5 rounded font-label-md text-label-md ${dirType === v ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
                {l}
              </button>
            ))}
          </div>
          {dirType !== "teacher" && (
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(null); }}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder={dirType === "teacher" ? "Search teachers by name or email…" : "Search by name…"}
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
          {!selected && results.length > 0 && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant max-h-56 overflow-y-auto">
              {results.map((r) => (
                <button type="button" key={`${r.type}-${r.id}`}
                  onClick={() => { setSelected(r); setQuery(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-surface-container-low">
                  <span className="font-label-md text-label-md text-on-surface">{r.label}</span>
                  {r.sublabel && <span className="font-label-sm text-label-sm text-on-surface-variant ml-2">{r.sublabel}</span>}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center gap-2 bg-primary-container/10 border border-outline-variant rounded p-2">
              <span className="font-label-md text-label-md text-on-surface">To: {selected.label}{selected.sublabel ? ` (${selected.sublabel})` : ""}</span>
              <button type="button" onClick={() => setSelected(null)} className="font-label-sm text-label-sm text-primary underline ml-auto">Change</button>
            </div>
          )}
        </>
      )}

      {mode === "bulk" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {AUDIENCES.map((a) => (
              <button key={a.value} type="button"
                onClick={() => { setAudienceType(a.value); if (!a.needsClass) setClassId(""); }}
                className={`px-3 py-2 rounded font-label-md text-label-md text-left ${audienceType === a.value ? "bg-primary text-white" : "border border-outline-variant text-on-surface"}`}>
                {a.label}
              </button>
            ))}
          </div>
          {audienceType === "parents_by_fee" && (
            <div className="flex gap-3 flex-wrap">
              {FEE_OPTIONS.map((f) => (
                <label key={f.value} className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
                  <input type="checkbox" checked={feeStatuses.includes(f.value)}
                    onChange={(e) => setFeeStatuses((prev) => e.target.checked ? [...prev, f.value] : prev.filter((s) => s !== f.value))} />
                  {f.label}
                </label>
              ))}
            </div>
          )}
          {AUDIENCES.find((a) => a.value === audienceType)?.needsClass && (
            <select value={classId} onChange={(e) => setClassId(e.target.value)}
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md">
              <option value="">Whole school (all classes)</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <p className="font-label-md text-label-md text-on-surface-variant">
            {bulkCount === null ? "Counting recipients…" : `Will send to ${bulkCount} recipient${bulkCount === 1 ? "" : "s"} (private 1:1).`}
          </p>
        </>
      )}

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

      {mode === "individual" ? (
        <button type="submit" disabled={sending || (useDirectory && !selected) || (!useDirectory && !legacyRecipientId)}
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {sending ? "Sending..." : "Send Message"}
        </button>
      ) : (
        <button type="button" onClick={submitBulk} disabled={sending || !bulkCount}
          className="bg-primary text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {sending ? "Sending..." : `Send to ${bulkCount ?? 0} recipients`}
        </button>
      )}
    </form>
  );
}
