import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { EssayGradingView } from "./essay-grading-view";

export default async function EssayGradingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const exams = await prisma.exam.findMany({
    where: { schoolId: user.schoolId },
    include: { subject: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pendingCount = await prisma.studentAnswer.count({
    where: {
      gradingStatus: "ai_pending",
      essayResponseText: { not: null },
      attempt: { exam: { schoolId: user.schoolId } },
    },
  });

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Essay Grading
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          AI-graded essay answers — review, accept, or override scores.
        </p>
      </div>

      <EssayGradingView
        exams={exams.map((e) => ({ id: e.id, label: `${e.subject.name} · ${e.class.name}` }))}
        pendingCount={pendingCount}
      />
    </div>
  );
}
