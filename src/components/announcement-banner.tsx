import { prisma } from "@/lib/prisma";
import { AnnouncementBannerClient } from "./announcement-banner-client";

export async function AnnouncementBanner({
  schoolId,
  userRole,
}: {
  schoolId: string;
  userRole: string;
}) {
  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      schoolId,
      publishedAt: { not: null, lte: now },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      targetRoles: { has: userRole },
    },
    orderBy: [{ isSticky: "desc" }, { publishedAt: "desc" }],
  });

  if (announcements.length === 0) return null;

  const toBanner = (a: { id: string; title: string; content: string }) => ({
    id: a.id,
    title: a.title,
    content: a.content,
  });

  const sticky = announcements.filter((a) => a.isSticky).map(toBanner);
  const regular = announcements.filter((a) => !a.isSticky).map(toBanner);

  return <AnnouncementBannerClient sticky={sticky} regular={regular} />;
}
