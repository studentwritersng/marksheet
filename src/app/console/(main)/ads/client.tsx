"use client";

import { useState } from "react";
import { createPlatformAd, deletePlatformAd, updatePlatformAd } from "./actions";

const ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
] as const;

type Ad = {
  id: string;
  title: string;
  blobUrl: string;
  targetRoles: string[];
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
};

function statusOf(a: Ad): { text: string; cls: string } {
  const now = new Date();
  if (!a.active) return { text: "Inactive", cls: "bg-slate-700 text-slate-200" };
  if (a.expiresAt && a.expiresAt < now) return { text: "Expired", cls: "bg-slate-700 text-slate-300" };
  return { text: "Active", cls: "bg-emerald-600 text-white" };
}

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return dt.toISOString().slice(0, 16);
}

export function ConsoleAdsClient({ initialAds }: { initialAds: Ad[] }) {
  const [ads, setAds] = useState<Ad[]>(initialAds as any);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!file) return setMsg("Choose an .html file.");
    if (roles.length === 0) return setMsg("Select at least one role.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/console/ads/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const created = await createPlatformAd({
        title,
        blobUrl: data.url,
        targetRoles: roles,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        active,
      });
      if (created.error) throw new Error(created.error);
      setMsg("Ad created.");
      setTitle(""); setFile(null); setRoles([]); setExpiresAt(""); setActive(true);
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ad?")) return;
    const res = await deletePlatformAd(id);
    if (!res.error) setAds((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleExpiry(id: string, value: string) {
    const res = await updatePlatformAd(id, {
      expiresAt: value ? new Date(value).toISOString() : null,
    });
    if (!res.error) {
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, expiresAt: value ? new Date(value) : null } : a)),
      );
    }
  }

  async function handleToggle(id: string, next: boolean) {
    const res = await updatePlatformAd(id, { active: next });
    if (!res.error) setAds((prev) => prev.map((a) => (a.id === id ? { ...a, active: next } : a)));
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="bg-[#0f1525] border border-white/10 rounded-lg p-5 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold text-white">New Ad</h2>
        <input className="w-full bg-[#0a0e1a] text-white border border-white/10 rounded px-3 py-2"
          placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input type="file" accept=".html,text/html" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-white" required />
        <div>
          <p className="text-sm text-slate-300 mb-2">Target roles</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1 text-sm text-white bg-[#0a0e1a] border border-white/10 rounded px-2 py-1">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-300">Expiry (optional)</label>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="bg-[#0a0e1a] text-white border border-white/10 rounded px-3 py-2" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <button type="submit" disabled={busy}
          className="bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-50">
          {busy ? "Saving…" : "Create Ad"}
        </button>
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Existing Ads</h2>
        {ads.length === 0 && <p className="text-slate-400 text-sm">No ads yet.</p>}
        {ads.map((a) => {
          const st = statusOf(a);
          return (
            <div key={a.id} className="bg-[#0f1525] border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{a.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${st.cls}`}>{st.text}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Targets: {a.targetRoles.join(", ")}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-slate-400">Expiry:</span>
                    <input type="datetime-local" defaultValue={toLocalInput(a.expiresAt)}
                      onBlur={(e) => handleExpiry(a.id, e.target.value)}
                      className="bg-[#0a0e1a] text-white border border-white/10 rounded px-2 py-1 text-xs" />
                    <label className="flex items-center gap-1 text-xs text-white">
                      <input type="checkbox" defaultChecked={a.active} onChange={(e) => handleToggle(a.id, e.target.checked)} /> Active
                    </label>
                    <a href={a.blobUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">Preview</a>
                  </div>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-red-400 text-xs hover:underline shrink-0">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
