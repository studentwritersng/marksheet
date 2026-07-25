import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { WeightingsPage } from "./weightings-form";

export default async function AssessmentWeightingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [subjects, weightings, assessmentTypes] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.assessmentWeighting.findMany({ where: { schoolId: user.schoolId } }),
    prisma.assessmentType.findMany({
      where: { schoolId: user.schoolId },
      include: { children: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Assessment Types &amp; Weightings</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Define your assessment types (CA, Mid Term, Exam, etc.), then set their mark allocations.
        All types must add up to <strong>100 marks</strong> — this becomes the student's final term score out of 100.
        School-wide defaults apply when no per-subject override is set.
      </p>

      <div className="mt-6">
        <WeightingsPage
          schoolId={user.schoolId}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          weightings={weightings.map((w) => ({
            id: w.id,
            subjectId: w.subjectId,
            assessmentTypeId: w.assessmentTypeId,
            weightPercentage: w.weightPercentage,
          }))}
          assessmentTypes={assessmentTypes.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            sortOrder: t.sortOrder,
            parentId: t.parentId,
            children: t.children.map((c) => ({ id: c.id, name: c.name, code: c.code, sortOrder: c.sortOrder })),
          }))}
        />
      </div>
    </div>
  );
}
