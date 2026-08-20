import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const config = await prisma.analyticsConfig.findFirst();
  const events = await prisma.conversionEventDefinition.findMany({
    orderBy: { eventName: "asc" },
  });

  return (
    <AnalyticsClient
      config={
        config
          ? {
              id: config.id,
              ga4MeasurementId: config.ga4MeasurementId,
              consentModeEnabled: config.consentModeEnabled,
              isActive: config.isActive,
            }
          : null
      }
      events={events.map((e) => ({
        id: e.id,
        eventName: e.eventName,
        ga4EventMapping: e.ga4EventMapping,
        isActive: e.isActive,
      }))}
    />
  );
}
