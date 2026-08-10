"use client";

import { useState } from "react";
import { useActionState } from "react";
import { registerHubAction, revokeHubAction, type OfflineActionResult } from "@/lib/offline/actions";

const init: OfflineActionResult = {};

type HubRow = { id: string; name: string; schoolName: string; status: string; lastSeenAt: string | null; createdAt: string };
type SchoolRow = { id: string; name: string };

export function OfflineHubsClient({ hubs, schools }: { hubs: HubRow[]; schools: SchoolRow[] }) {
  const [state, action, pending] = useActionState(registerHubAction, init);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeHubAction, init);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Offline Hubs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Register a school&apos;s exam-hall hub. The API key and signing secret are shown once —
          copy them into the hub&apos;s config.
        </p>
      </div>

      <form action={action} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="schoolId" required className="rounded-lg border border-gray-300 p-2 text-sm">
            <option value="">Select school…</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input name="name" required placeholder="e.g. Exam Hall 1" className="rounded-lg border border-gray-300 p-2 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm px-4 py-2 disabled:opacity-60">
          {pending ? "Registering…" : "Register hub"}
        </button>
        {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
        {state.success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
            <p className="text-emerald-700 font-medium">{state.success}</p>
            {state.data?.apiKey && !revealed && (
              <button type="button" onClick={() => setRevealed(true)} className="text-blue-700 underline text-xs">
                Reveal credentials (shown once)
              </button>
            )}
            {revealed && (
              <div className="text-xs font-mono text-gray-800 space-y-1">
                <p>API key: {state.data?.apiKey}</p>
                <p>Signing secret: {state.data?.signingSecret}</p>
                <p>Invigilator code: {state.data?.invigilatorCode}</p>
              </div>
            )}
          </div>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">School</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last seen</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hubs.map((h) => (
              <tr key={h.id}>
                <td className="p-3 font-medium">{h.name}</td>
                <td className="p-3 text-gray-600">{h.schoolName}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {h.status}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{h.lastSeenAt ? new Date(h.lastSeenAt).toLocaleString() : "never"}</td>
                <td className="p-3 text-right">
                  {h.status === "active" && (
                    <form action={revokeAction}>
                      <input type="hidden" name="hubId" value={h.id} />
                      <button type="submit" disabled={revokePending} className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50">
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {hubs.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">No hubs registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}