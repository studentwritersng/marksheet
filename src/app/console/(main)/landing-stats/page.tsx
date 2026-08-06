import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ensureLandingStats, LANDING_STAT_DEFAULTS } from "@/lib/landing-stats";
import { LandingStatsClient } from "./landing-stats-client";

export default async function LandingStatsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const stats = await ensureLandingStats();

  return (
    <LandingStatsClient
      stats={stats.map((s) => ({
        id: s.id,
        key: s.key,
        label: s.label,
        valueSource: s.valueSource as "auto" | "manual",
        manualValue: s.manualValue,
        enabled: s.enabled,
        displayOrder: s.displayOrder,
      }))}
      autoKeys={Object.fromEntries(
        LANDING_STAT_DEFAULTS.filter((d) => d.valueSource === "auto").map((d) => [d.key, true]),
      )}
    />
  );
}
