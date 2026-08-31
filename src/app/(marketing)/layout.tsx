import { prisma } from "@/lib/prisma";
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics";
import MarketingHeader from "@/components/marketing/MarketingHeader";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await prisma.analyticsConfig.findFirst();

  return (
    <div className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
      <MarketingHeader />
      {children}
      <PublicAnalytics
        measurementId={cfg?.ga4MeasurementId ?? null}
        consentModeEnabled={cfg?.consentModeEnabled ?? false}
        isActive={cfg?.isActive ?? false}
      />
    </div>
  );
}