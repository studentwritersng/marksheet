"use client";

import { useState } from "react";
import { regenerateTimetableAction } from "@/app/(app)/timetable/wizard/actions";

export function RegenerateButton() {
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    if (!confirm("This will delete all existing entries and regenerate the timetable based on your current setup. This action cannot be undone. Continue?")) return;
    setLoading(true);
    try {
      const result = await regenerateTimetableAction();
      if (result.error) {
        alert(result.error);
      } else {
        window.location.reload();
      }
    } catch {
      alert("Failed to regenerate timetable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container transition-colors text-sm disabled:opacity-50"
    >
      {loading ? "Regenerating..." : "Regenerate"}
    </button>
  );
}
