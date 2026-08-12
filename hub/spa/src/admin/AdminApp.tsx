import { useCallback, useEffect, useState } from "react";
import {
  closeAdminSession,
  fetchAdminSessions,
  fetchAdminStatus,
  fetchBundlePins,
  openAdminSession,
  triggerSync,
  type AdminSession,
  type BundlePins,
} from "../api";
import { downloadPinsCsv, downloadPinsDocx, downloadPinsTxt } from "../pins";
import { useBranding } from "../branding";
import { HubShell } from "../HubShell";

export default function AdminApp() {
  const branding = useBranding();
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [status, setStatus] = useState<{ bundles: number; pendingSyncAttempts: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [pins, setPins] = useState<BundlePins | null>(null);
  const [pinsBusy, setPinsBusy] = useState(false);
  const [pinsError, setPinsError] = useState("");

  const load = useCallback(
    async (c: string) => {
      setError("");
      try {
        const [s, st] = await Promise.all([fetchAdminSessions(c), fetchAdminStatus(c)]);
        setSessions(s);
        setStatus(st);
        return true;
      } catch (e: any) {
        setError(e?.message ?? "Failed to load admin data.");
        return false;
      }
    },
    [],
  );

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const ok = await load(code.trim());
    setBusy(false);
    if (ok) setAuthed(true);
  };

  useEffect(() => {
    if (authed) load(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setSyncMsg("");
    try {
      const r = await triggerSync(code.trim());
      setSyncMsg(`Synced: ${r.pulled} bundle(s) pulled, ${r.uploaded} attempt(s) uploaded.`);
      await load(code.trim());
    } catch (e: any) {
      setError(e?.message ?? "Sync failed.");
    }
    setSyncing(false);
  };

  const toggle = async (bundleId: string, status: AdminSession["status"]) => {
    setBusy(true);
    setError("");
    try {
      if (status === "open") await closeAdminSession(code.trim(), bundleId);
      else await openAdminSession(code.trim(), bundleId);
      await load(code.trim());
    } catch (e: any) {
      setError(e?.message ?? "Action failed.");
    }
    setBusy(false);
  };

  const viewPins = async (bundleId: string) => {
    setPinsBusy(true);
    setPinsError("");
    try {
      setPins(await fetchBundlePins(code.trim(), bundleId));
    } catch (e: any) {
      setPinsError(e?.message ?? "Failed to load PINs.");
    }
    setPinsBusy(false);
  };

  const closePins = () => {
    setPins(null);
    setPinsError("");
  };

  const pinRows = pins?.roster ?? [];

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.schoolName} className="mx-auto mb-3 w-14 h-14 rounded-full object-contain" />
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary-container mb-3">
                <span className="material-symbols-outlined text-[28px] text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                  shield_lock
                </span>
              </div>
            )}
            <h1 className="font-headline-md text-headline-md text-on-surface">{branding.schoolName} — Invigilator</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">Enter the invigilator code to manage sessions.</p>
          </div>

          <form onSubmit={login} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
            <label className="block space-y-1">
              <span className="font-label-md text-label-md text-on-surface">Invigilator code</span>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </label>
            {error && <div className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg p-3">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-on-primary font-label-lg text-label-lg rounded-lg px-4 py-3 hover:bg-primary-strong disabled:opacity-50 transition-colors"
            >
              {busy ? "Checking…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <HubShell
        branding={branding}
        badge="Invigilator console"
        profile={{ name: "Invigilator", subline: status ? `${status.bundles} bundle(s) on hub` : "Session control" }}
        nav={[
          { icon: "fact_check", label: "Exam Sessions", active: true },
          { icon: "sync", label: syncing ? "Syncing…" : "Sync now", onClick: syncNow },
          { icon: "logout", label: "Sign out", onClick: () => { setAuthed(false); setCode(""); setSessions([]); } },
        ]}
      >
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">Exam Sessions</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Open a session when students are ready; close it when the exam ends.
            </p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-secondary-container text-on-secondary-container px-4 py-2.5 text-sm font-semibold hover:opacity-85 disabled:opacity-50 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        {/* Status cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Bundles on hub</p>
            <p className="mt-1 text-2xl font-semibold text-on-surface">{status?.bundles ?? "—"}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Open sessions</p>
            <p className="mt-1 text-2xl font-semibold text-on-surface">
              {sessions.filter((s) => s.status === "open").length}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Pending sync</p>
            <p className="mt-1 text-2xl font-semibold text-on-surface">{status?.pendingSyncAttempts ?? "—"}</p>
          </div>
        </div>

        {syncMsg && (
          <div className="mt-4 bg-secondary-container text-on-secondary-container font-body-sm text-body-sm rounded-lg p-3">
            {syncMsg}
          </div>
        )}
        {error && (
          <div className="mt-4 bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Sessions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-on-surface">Sessions</h2>
          <div className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
                <span
                  className="material-symbols-outlined text-[40px] text-on-surface-variant"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  inventory_2
                </span>
                <p className="mt-3 text-base font-medium text-on-surface">No sessions on this hub yet</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Use Sync now to pull exam bundles from the cloud.
                </p>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.bundleId}
                  className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-on-surface truncate">
                      {s.subjectName ?? s.bundleId}
                    </p>
                    <p className="mt-0.5 text-sm text-on-surface-variant">
                      {s.termLabel && `${s.termLabel} · `}
                      {s.durationMinutes} min
                      <span
                        className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "open"
                            ? "bg-secondary-container text-on-secondary-container"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {s.status === "open" ? "Open" : "Closed"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={busy || pinsBusy}
                      onClick={() => viewPins(s.bundleId)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">pin</span>
                      View PINs
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => toggle(s.bundleId, s.status)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 ${
                        s.status === "open"
                          ? "bg-error-container text-on-error-container hover:opacity-85"
                          : "bg-primary text-on-primary hover:opacity-90"
                      }`}
                    >
                      {s.status === "open" ? "Close" : "Open"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </HubShell>

      {pins && <PinsModal pins={pins} onClose={closePins} />}
    </>
  );
}

function PinsModal({
  pins,
  onClose,
}: {
  pins: BundlePins;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async (format: "txt" | "csv" | "docx") => {
    setDownloading(true);
    try {
      if (format === "txt") downloadPinsTxt(pins.subjectName, pins.roster);
      else if (format === "csv") downloadPinsCsv(pins.subjectName, pins.roster);
      else await downloadPinsDocx(pins.subjectName, pins.roster);
    } catch (e: any) {
      alert(e?.message ?? "Download failed.");
    }
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <div>
            <h2 className="font-label-lg text-label-lg text-on-surface">Student PINs — {pins.subjectName}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{pins.roster.length} student(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => download("txt")}
              disabled={downloading}
              className="font-label-sm text-label-sm rounded-lg px-3 py-2 border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-colors"
            >
              .txt
            </button>
            <button
              onClick={() => download("csv")}
              disabled={downloading}
              className="font-label-sm text-label-sm rounded-lg px-3 py-2 border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-colors"
            >
              .csv
            </button>
            <button
              onClick={() => download("docx")}
              disabled={downloading}
              className="font-label-sm text-label-sm rounded-lg px-3 py-2 border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-colors"
            >
              .docx
            </button>
            <button onClick={onClose} className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface px-2">
              Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          <table className="w-full border border-outline-variant rounded-lg overflow-hidden">
            <thead className="bg-surface-container-high">
              <tr>
                <th className="text-left font-label-sm text-label-sm text-on-surface-variant px-3 py-2">Admission No</th>
                <th className="text-left font-label-sm text-label-sm text-on-surface-variant px-3 py-2">Student</th>
                <th className="text-left font-label-sm text-label-sm text-on-surface-variant px-3 py-2">PIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {pins.roster.map((r) => (
                <tr key={r.admissionNumber}>
                  <td className="px-3 py-2 font-body-sm text-body-sm text-on-surface">{r.admissionNumber}</td>
                  <td className="px-3 py-2 font-body-sm text-body-sm text-on-surface">{r.studentName}</td>
                  <td className="px-3 py-2 font-body-sm text-body-sm text-on-surface tracking-widest font-medium">{r.pin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
