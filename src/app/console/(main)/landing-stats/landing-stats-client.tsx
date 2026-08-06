"use client";

import { useActionState } from "react";
import { updateLandingStatAction, type LandingStatsActionResult } from "./actions";

type StatRow = {
  id: string;
  key: string;
  label: string;
  valueSource: "auto" | "manual";
  manualValue: string;
  enabled: boolean;
  displayOrder: number;
};

const init: LandingStatsActionResult = {};

export function LandingStatsClient({
  stats,
  autoKeys,
}: {
  stats: StatRow[];
  autoKeys: Record<string, boolean>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Landing Stats</h1>
        <p className="text-sm text-gray-500 mt-1">
          Control the numbers shown in the hero section of the public landing page.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Auto stats pull live platform counts (schools registered, students, verifications).
        Manual stats use the value you type below.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((s) => (
          <StatCard key={s.id} stat={s} isAuto={Boolean(autoKeys[s.key])} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ stat, isAuto }: { stat: StatRow; isAuto: boolean }) {
  const [state, action, pending] = useActionState(updateLandingStatAction, init);

  return (
    <form action={action} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <input type="hidden" name="statId" value={stat.id} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">{stat.key}</p>
          <p className="text-sm font-medium text-gray-700 mt-1">{stat.label}</p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={stat.enabled}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-500">Visible</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Label shown on page</label>
        <input
          name="label"
          defaultValue={stat.label}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Value source</label>
        <select
          name="valueSource"
          defaultValue={stat.valueSource}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {isAuto ? (
            <>
              <option value="auto">Auto (live platform count)</option>
              <option value="manual">Manual value</option>
            </>
          ) : (
            <>
              <option value="manual">Manual value</option>
              <option value="auto">Auto (live platform count)</option>
            </>
          )}
        </select>
      </div>

      {!isAuto && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
          <input
            name="manualValue"
            defaultValue={stat.manualValue || ""}
            placeholder="e.g. 99.9%"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2">
          {state.success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 text-sm"
      >
        {pending ? "Saving..." : "Save Stat"}
      </button>
    </form>
  );
}
