"use client";

import { useActionState } from "react";
import { createSchoolAction, type SchoolActionResult } from "./actions";

interface PlanStageVM { id: string; name: string; price?: number | null; planName: string; durationType: string; }

const init: SchoolActionResult = {};

export function NewSchoolForm({ onClose, planStages }: { onClose: () => void; planStages: PlanStageVM[] }) {
  const [state, action, pending] = useActionState(createSchoolAction, init);

  if (state.success) {
    return (
      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-6 text-center">
        <p className="text-emerald-300 font-medium mb-2">{state.success}</p>
        <button
          onClick={onClose}
          className="text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <h3 className="text-white font-semibold text-sm">New School</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-white/40 mb-1">School Name *</label>
          <input
            name="name"
            required
            placeholder="e.g. Unity Model Secondary School"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-white/40 mb-1">Address</label>
          <input
            name="address"
            placeholder="School address"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Phone</label>
          <input
            name="phone"
            placeholder="Phone number"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Email</label>
          <input
            name="email"
            type="email"
            placeholder="School email"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Shortcode</label>
          <input
            name="shortcode"
            placeholder="e.g. TDC"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Pricing Stage *</label>
          <select name="stageId" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
            <option value="">Select plan + stage…</option>
            {planStages.map((ps) => (
              <option key={ps.id} value={ps.id}>
                {ps.planName} ({ps.durationType}) — {ps.name}{ps.price != null ? ` — ₦${ps.price.toLocaleString()}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="text-xs text-white/40">
        <summary className="cursor-pointer hover:text-white/60">Admin account (optional)</summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">First Name</label>
            <input
              name="adminFirstName"
              placeholder="John"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Last Name</label>
            <input
              name="adminLastName"
              placeholder="Doe"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Admin Email</label>
            <input
              name="adminEmail"
              type="email"
              placeholder="admin@school.edu.ng"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Admin Password</label>
            <input
              name="adminPassword"
              type="password"
              placeholder="Min 6 characters"
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>
      </details>

      {state.error && (
        <p className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="text-xs bg-white text-[#0a0e1a] font-medium px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create School"}
        </button>
      </div>
    </form>
  );
}
