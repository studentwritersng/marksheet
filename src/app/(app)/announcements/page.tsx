import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AnnouncementsList } from "./announcements-list";
import { AnnouncementBanner } from "@/components/announcement-banner";

export default async function AnnouncementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!user.schoolId) return <p className="font-body-sm text-body-sm text-on-surface-variant">Not available.</p>;

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
            {admin ? "Create and manage announcements." : "View school announcements."}
          </p>
        </div>
      </div>
      {admin ? (
        <AnnouncementsList announcements={announcements} />
      ) : (
        <div className="space-y-3">
          {announcements.filter((a) => a.publishedAt && a.publishedAt <= new Date() && (!a.expiresAt || a.expiresAt > new Date())).map((a) => (
            <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-label-md text-label-md text-on-surface font-semibold">{a.title}</h3>
                {a.isSticky && <span className="rounded-full bg-primary-container text-on-primary-container px-2 py-0.5 text-[11px] font-medium">Sticky</span>}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: a.content }} />
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">No announcements yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
