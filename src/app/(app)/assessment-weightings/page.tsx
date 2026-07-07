import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { WeightingsForm } from "./weightings-form";

export default async function AssessmentWeightingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [subjects, weightings] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.assessmentWeighting.findMany({ where: { schoolId: user.schoolId } }),
  ]);

  // Collect unique assessment type labels from weightings
  const assessmentTypes = [...new Set(weightings.map((w) => w.assessmentTypeId))];

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Assessment Weightings</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Configure per-subject or school-wide assessment weights (e.g. CA1=10%, Exam=70%).
        Defaults apply when no subject-specific weight is set.
      </p>

      <div className="mt-6">
        <WeightingsForm
          schoolId={user.schoolId}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          weightings={weightings.map((w) => ({
            subjectId: w.subjectId,
            assessmentTypeId: w.assessmentTypeId,
            weightPercentage: w.weightPercentage,
          }))}
          assessmentTypes={assessmentTypes}
        />
      </div>
    </div>
  );
}
