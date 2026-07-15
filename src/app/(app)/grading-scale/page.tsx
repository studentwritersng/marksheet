import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { defaultGradingScale } from "@/lib/grading-scale";
import { GradingScaleForm } from "./grading-scale-form";

export default async function GradingScalePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { gradingScale: true },
  });

  const bands = (school?.gradingScale != null
    ? (school.gradingScale as unknown as typeof defaultGradingScale)
    : defaultGradingScale);

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        Grading Scale
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Define the score bands and letter grades used for subject results. Changes apply to all future computations.
      </p>

      <div className="mt-6 max-w-xl">
        <GradingScaleForm bands={bands} />
      </div>

      <div className="mt-8 max-w-xl bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
        <h3 className="font-label-md text-label-md text-on-surface mb-2">How grading works</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Each student&apos;s weighted score for a subject is matched against these bands from highest to lowest.
          The first band where the score falls within the min–max range determines the grade.
          Scores below the lowest band&apos;s minimum default to F9.
        </p>
      </div>
    </div>
  );
}
