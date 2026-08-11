"use client";

import { useState } from "react";
import { releaseExamToHub, cancelReleaseToHubAction, type OfflineActionResult } from "@/lib/offline/actions";

type HubRow = { id: string; name: string; status: string };

export function OfflineSyncCard({ examId, hubs, offlineStatus, canRegister = false }: {
  examId: string;
  hubs: HubRow[];
  offlineStatus: string;
  canRegister?: boolean;
}) {
  const [hubId, setHubId] = useState("");
  const [state, setState] = useState<OfflineActionResult>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!hubId) return;
    setPending(true);
    const res = await releaseExamToHub(examId, hubId);
    setState(res);
    setPending(false);
  }

  async function cancelRelease() {
    setPending(true);
    const res = await cancelReleaseToHubAction(examId);
    setState(res);
    setPending(false);
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
      <h2 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">Offline sync</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Status: <span className="font-medium text-on-surface">{offlineStatus}</span>
      </p>
      {offlineStatus === "none" && hubs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface p-2 text-sm text-on-surface"
          >
            <option value="">Select hub…</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={pending || !hubId}
            className="rounded-lg bg-[#002046] hover:bg-[#003366] text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {pending ? "Releasing…" : "Release to hub"}
          </button>
        </div>
      )}
      {offlineStatus === "released" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={cancelRelease}
            disabled={pending}
            className="rounded-lg border border-red-300 text-red-700 text-sm px-4 py-2 hover:bg-red-50 disabled:opacity-50"
          >
            {pending ? "Cancelling…" : "Cancel release"}
          </button>
        </div>
      )}
      {offlineStatus === "none" && hubs.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {canRegister ? (
            <>
              No active hubs for this school.{" "}
              <a href="/offline-hubs" className="text-primary underline">Register a hub</a>.
            </>
          ) : (
            "No active hubs for this school."
          )}
        </p>
      )}
      {state.error && <p className="mt-2 text-red-600 text-xs">{state.error}</p>}
      {state.success && <p className="mt-2 text-emerald-600 text-xs">{state.success}</p>}
    </div>
  );
}