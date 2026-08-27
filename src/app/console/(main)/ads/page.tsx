import { prisma } from "@/lib/prisma";
import { ConsoleAdsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ConsoleAdsPage() {
  const ads = await prisma.platformAd.findMany({
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Ads</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload full-page HTML ads that pop up on selected roles' dashboards.
        </p>
      </div>
      <ConsoleAdsClient initialAds={ads} />
    </div>
  );
}
