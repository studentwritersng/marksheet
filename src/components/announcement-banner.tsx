import { prisma } from "@/lib/prisma";

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

  const sticky = announcements.filter((a) => a.isSticky);
  const regular = announcements.filter((a) => !a.isSticky);

  return (
    <div className="space-y-2">
      {sticky.length > 0 && (
        <div className="bg-primary-fixed border border-primary/30 rounded-lg overflow-hidden">
          <div className="overflow-hidden whitespace-nowrap py-2">
            <div className="inline-flex gap-12" style={{ animation: "marquee 30s linear infinite" }}>
              {sticky.map((a) => (
                <span key={a.id} className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0">
                  <strong>{a.title}:</strong> {a.content}
                </span>
              ))}
              {sticky.map((a) => (
                <span key={`dup-${a.id}`} className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0">
                  <strong>{a.title}:</strong> {a.content}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {regular.map((a) => (
        <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
          <p className="font-label-md text-label-md text-on-surface font-semibold">{a.title}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{a.content}</p>
        </div>
      ))}
    </div>
  );
}
