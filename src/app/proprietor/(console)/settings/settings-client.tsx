"use client";

import { useState } from "react";

interface SettingsData {
  group: {
    id: string;
    name: string;
    feeGroupStage: string | null;
    createdAt: string;
    branches: { id: string; name: string; stage: string }[];
  };
  userEmail: string;
  permissionLevel: string;
}

const STAGE_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

export function SettingsClient({ group, userEmail, permissionLevel }: { group: SettingsData["group"]; userEmail: string; permissionLevel: string }) {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Account and group information</p>
      </div>

      {/* Account */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Email</span>
            <span className="text-white">{userEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Access level</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${permissionLevel === "full" ? "bg-emerald-900/30 text-emerald-300" : "bg-gray-800 text-gray-300"}`}>
              {permissionLevel === "full" ? "Full" : "View Only"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowChangePassword(!showChangePassword)}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          {showChangePassword ? "Close" : "Change password"}
        </button>
        {showChangePassword && (
          <iframe
            src="/proprietor/change-password"
            className="w-full h-96 border border-white/10 rounded-lg"
            title="Change Password"
          />
        )}
      </div>

      {/* Group info */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Group</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Name</span>
            <span className="text-white">{group.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Created</span>
            <span className="text-white">{new Date(group.createdAt).toLocaleDateString()}</span>
          </div>
          {group.feeGroupStage && (
            <div className="flex justify-between">
              <span className="text-white/40">Pricing tier</span>
              <span className="text-white capitalize">{STAGE_LABELS[group.feeGroupStage] ?? group.feeGroupStage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Branches */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Branches ({group.branches.length})</h2>
        {group.branches.length === 0 ? (
          <p className="text-xs text-white/30 italic">No schools in this group.</p>
        ) : (
          <ul className="space-y-1">
            {group.branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between bg-white/5 rounded p-2 text-xs">
                <span className="text-white">{b.name}</span>
                <span className="text-white/40 capitalize">{STAGE_LABELS[b.stage] ?? b.stage}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
