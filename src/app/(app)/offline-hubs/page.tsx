import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { HubManager } from "@/components/offline/hub-manager";
import { BatchReleasePanel } from "@/components/offline/batch-release-panel";

export default async function OfflineHubsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [hubs, eligibleExams] = await Promise.all([
    prisma.hub.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.exam.findMany({
      where: { schoolId: user.schoolId, status: "published", offlineStatus: "none" },
      include: {
        subject: { select: { name: true } },
        term: { include: { session: { select: { label: true } } } },
        classes: { include: { class: { select: { name: true } } } },
        examQuestions: { select: { questionId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeHubs = hubs.filter((h) => h.status === "active");

  const allClassIds = [...new Set(eligibleExams.flatMap((e) => e.classes.map((ec) => ec.classId)))];
  const studentCounts = allClassIds.length > 0
    ? await prisma.student.groupBy({
        by: ["currentClassId"],
        where: { schoolId: user.schoolId, status: "active", currentClassId: { in: allClassIds } },
        _count: { _all: true },
      })
    : [];
  const countsByClass = new Map(studentCounts.map((s) => [s.currentClassId, s._count._all]));

  const releaseExams = eligibleExams
    .map((e) => ({
      id: e.id,
      subjectName: e.subject.name,
      classNames: e.classes.map((ec) => ec.class.name).join(", "),
      termLabel: `${e.term.name} (${e.term.session.label})`,
      questionCount: e.examQuestions.length,
      studentCount: e.classes.reduce((n, ec) => n + (countsByClass.get(ec.classId) ?? 0), 0),
    }))
    .filter((e) => e.questionCount > 0 && e.studentCount > 0);

  return (
    <div className="space-y-6">
      <BatchReleasePanel
        hubs={activeHubs.map((h) => ({ id: h.id, name: h.name }))}
        exams={releaseExams}
      />
      <HubManager
        mode="manage"
        hubs={hubs.map((h) => ({
          id: h.id,
          name: h.name,
          status: h.status,
          lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
          createdAt: h.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}