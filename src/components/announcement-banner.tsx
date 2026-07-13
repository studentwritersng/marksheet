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

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, "");
  }

  return (
    <div className="space-y-2 sticky top-16 z-10">
      {sticky.length > 0 && (
        <div className="bg-primary-fixed border border-primary/30 rounded-lg overflow-hidden">
          <div className="overflow-hidden whitespace-nowrap py-2">
            <div className="inline-flex gap-12" style={{ animation: "marquee 30s linear infinite" }}>
              {sticky.map((a) => (
                <span key={a.id} className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0">
                  <strong>{a.title}:</strong> {stripHtml(a.content)}
                </span>
              ))}
              {sticky.map((a) => (
                <span key={`dup-${a.id}`} className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0">
                  <strong>{a.title}:</strong> {stripHtml(a.content)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {regular.map((a) => (
        <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
          <p className="font-label-md text-label-md text-on-surface font-semibold">{a.title}</p>
          <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: a.content }} />
        </div>
      ))}
    </div>
  );
}
