"use client";

import { useActionState, useState, useCallback } from "react";
import { saveGradingScaleAction, resetGradingScaleAction } from "./actions";
import type { GradeBand } from "@/lib/grading-scale";

const initState: { error?: string; success?: string } = {};

export function GradingScaleForm({ bands: initial }: { bands: GradeBand[] }) {
  const [state, action, pending] = useActionState(saveGradingScaleAction, initState);
  const [bands, setBands] = useState<GradeBand[]>(initial);

  const updateBand = useCallback((index: number, field: keyof GradeBand, value: string | number) => {
    setBands((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const addBand = useCallback(() => {
    setBands((prev) => [...prev, { grade: "", min: 0, max: 0, remark: "" }]);
  }, []);

  const removeBand = useCallback((index: number) => {
    setBands((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReset = async () => {
    if (!confirm("Reset to the default grading scale?")) return;
    const res = await resetGradingScaleAction();
    if (res.success) setBands(res.success ? JSON.parse(JSON.stringify(initial)) : initial);
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="bands" value={JSON.stringify(bands)} />

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Grade</th>
              <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Min</th>
              <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Max</th>
              <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Remark</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {bands.map((band, i) => (
              <tr key={i} className="hover:bg-surface-container-low">
                <td className="py-2 px-3">
                  <input
                    value={band.grade}
                    onChange={(e) => updateBand(i, "grade", e.target.value)}
                    className="w-16 border border-outline-variant rounded p-1 font-body-sm text-body-sm"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={band.min}
                    onChange={(e) => updateBand(i, "min", Number(e.target.value))}
                    className="w-16 border border-outline-variant rounded p-1 font-body-sm text-body-sm"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={band.max}
                    onChange={(e) => updateBand(i, "max", Number(e.target.value))}
                    className="w-16 border border-outline-variant rounded p-1 font-body-sm text-body-sm"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    value={band.remark ?? ""}
                    onChange={(e) => updateBand(i, "remark", e.target.value)}
                    className="w-28 border border-outline-variant rounded p-1 font-body-sm text-body-sm"
                  />
                </td>
                <td className="py-2 px-3">
                  <button
                    type="button"
                    onClick={() => removeBand(i)}
                    disabled={bands.length <= 1}
                    className="text-red-600 hover:text-red-800 disabled:opacity-40 font-label-sm text-label-sm"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addBand} className="font-label-sm text-label-sm text-primary hover:underline">
        + Add Grade Band
      </button>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {pending ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" onClick={handleReset} className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface border border-outline-variant rounded py-2 px-3">
          Reset to Default
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
