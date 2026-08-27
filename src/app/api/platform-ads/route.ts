import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterActiveAdsForRole } from "@/lib/platform-ads";

const VALID_ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
];

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") || "";
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ads: [] });
  }

  const rows = await prisma.platformAd.findMany({
    where: { active: true },
    select: { id: true, title: true, blobUrl: true, expiresAt: true, targetRoles: true, createdAt: true },
  });

  const now = new Date();
  const filtered = filterActiveAdsForRole(rows as any, role, now).map((a) => ({
    id: (a as any).id,
    title: (a as any).title,
    blobUrl: (a as any).blobUrl,
  }));

  return NextResponse.json({ ads: filtered });
}
