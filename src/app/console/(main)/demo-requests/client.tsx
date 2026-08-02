"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDemoRequestStatusAction, deleteDemoRequestAction } from "./actions";

interface DemoRequestVM {
  id: string;
  contactName: string;
  schoolName: string;
  phone: string | null;
  email: string;
  studentCountRange: string | null;
  message: string | null;
  status: string;
  source: string;
  createdAt: string;
}

const STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-amber-100/10 text-amber-400",
  contacted: "bg-blue-100/10 text-blue-400",
  qualified: "bg-green-100/10 text-green-400",
  converted: "bg-emerald-100/10 text-emerald-400",
  closed: "bg-white/5 text-white/30",
};

interface Props {
  requests: DemoRequestVM[];
  counts: Record<string, number>;
  currentStatus: string;
}

export function DemoRequestsClient({ requests, counts, currentStatus }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<DemoRequestVM | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "new", label: "New", count: counts.new },
    { key: "contacted", label: "Contacted", count: counts.contacted },
    { key: "qualified", label: "Qualified", count: counts.qualified },
    { key: "converted", label: "Converted", count: counts.converted },
    { key: "closed", label: "Closed", count: counts.closed },
  ];

  async function changeStatus(id: string, status: string) {
    setBusyId(id);
    setError("");
    const res = await updateDemoRequestStatusAction(id, status);
    setBusyId(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this demo request?")) return;
    setBusyId(id);
    setError("");
    const res = await deleteDemoRequestAction(id);
    setBusyId(null);
    if (res.error) setError(res.error);
    else {
      router.refresh();
      if (selected?.id === id) setSelected(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400 bg-red-100/10 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => router.push(t.key === "all" ? "/console/demo-requests" : `/console/demo-requests?status=${t.key}`)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              currentStatus === t.key
                ? "bg-white text-black border-white"
                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
            }`}
          >
            {t.label} · {t.count}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              className={`block bg-white/5 border rounded-lg p-4 cursor-pointer transition-colors ${
                selected?.id === r.id ? "border-white/40 bg-white/10" : "border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm text-white font-semibold">{r.schoolName}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{r.contactName} · {r.email}</p>
                  <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1 flex-wrap">
                    {r.phone && <span>{r.phone}</span>}
                    {r.studentCountRange && <span>{r.studentCountRange} students</span>}
                    <span>{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <p className="text-sm text-white/30 py-10 text-center border border-dashed border-white/10 rounded-lg">
              No demo requests here yet.
            </p>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-5 h-fit lg:sticky lg:top-20">
          {selected ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">{selected.schoolName}</h3>
                <p className="text-xs text-white/50">Requested {new Date(selected.createdAt).toLocaleString()}</p>
              </div>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Contact</dt>
                  <dd className="text-white">{selected.contactName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Email</dt>
                  <dd className="text-white">{selected.email}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Phone</dt>
                  <dd className="text-white">{selected.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Students</dt>
                  <dd className="text-white">{selected.studentCountRange ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/40">Source</dt>
                  <dd className="text-white">{selected.source}</dd>
                </div>
                {selected.message && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-white/40">Message</dt>
                    <dd className="text-white/80 bg-white/5 rounded-lg p-3 text-sm leading-relaxed">{selected.message}</dd>
                  </div>
                )}
              </dl>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Status</p>
                <select
                  value={selected.status}
                  disabled={busyId === selected.id}
                  onChange={(e) => changeStatus(selected.id, e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-black">{s}</option>
                  ))}
                </select>
              </div>

              <a href={`mailto:${selected.email}`} className="w-full block text-center bg-white text-black font-medium text-sm py-2.5 rounded-lg hover:bg-white/90 transition-colors">
                Reply by email
              </a>
              <button
                onClick={() => remove(selected.id)}
                disabled={busyId === selected.id}
                className="w-full text-center bg-red-100/10 text-red-400 font-medium text-sm py-2.5 rounded-lg hover:bg-red-100/20 transition-colors disabled:opacity-50"
              >
                Delete request
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/40 text-center py-8">Select a request to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
