import { prisma } from "@/lib/prisma";
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics";
import MarketingHeader from "@/components/marketing/MarketingHeader";

const gtagScript = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-V5FXQRYGXX');
`;

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cfg = await prisma.analyticsConfig.findFirst();

  return (
    <>
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-V5FXQRYGXX"></script>
      <script dangerouslySetInnerHTML={{ __html: gtagScript }} />
      <div className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
        <MarketingHeader />
        {children}
        <PublicAnalytics
          measurementId={cfg?.ga4MeasurementId ?? null}
          consentModeEnabled={cfg?.consentModeEnabled ?? false}
          isActive={cfg?.isActive ?? false}
        />
      </div>
    </>
  );
}