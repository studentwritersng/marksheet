import { prisma } from "@/lib/prisma";
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await prisma.analyticsConfig.findFirst();

  return (
    <>
      {children}
      <PublicAnalytics
        measurementId={cfg?.ga4MeasurementId ?? null}
        consentModeEnabled={cfg?.consentModeEnabled ?? false}
        isActive={cfg?.isActive ?? false}
      />
    </>
  );
}
