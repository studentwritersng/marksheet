import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AnnouncementsList } from "./announcements-list";

export default async function AnnouncementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const announcements = await prisma.announcement.findMany({
    where: { schoolId: user.schoolId },
    orderBy: [{ isSticky: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Announcements</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Create announcements that appear on user dashboards. Sticky announcements scroll horizontally.
          </p>
        </div>
      </div>
      <AnnouncementsList announcements={announcements} />
    </div>
  );
}
