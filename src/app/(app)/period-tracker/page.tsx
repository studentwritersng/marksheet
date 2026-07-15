import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAddonActive } from "@/lib/addons/check";
import { SubjectCoverageCard } from "./coverage-card";
import { TeacherPeriodView } from "./teacher-view";
import { CaptainPeriodView } from "./captain-view";
import { AdminPeriodView } from "./admin-view";

export default async function PeriodTrackerPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const schoolId = user.schoolId;
  const addonActive = await isAddonActive(schoolId, "Period Tracker");

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Period Tracker</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Track curriculum coverage with two‑way verification</p>
      </div>

      {!addonActive && (
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Period Tracker addon is not active for your school. Enable it on the{" "}
          <a href="/addons" className="underline font-semibold">Addons</a> page.
        </div>
      )}

      {addonActive && (
        <>
          <SubjectCoverageCard schoolId={schoolId} />

          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
            <RoleSpecificView user={user} schoolId={schoolId} />
          </div>
        </>
      )}
    </section>
  );
}

async function RoleSpecificView({ user, schoolId }: { user: any; schoolId: string }) {
  const perms = await resolvePermissions(user);

  if (user.role === "super_admin" || user.role === "platform_owner") {
    return <p className="font-body-md text-body-md text-on-surface-variant">Super admins can view school‑level stats above.</p>;
  }

  const isAdmin = perms.isSuperAdmin || perms.isSchoolAdmin;

  if (isAdmin) {
    return <AdminPeriodView schoolId={schoolId} />;
  }

  if (user.role === "staff" && user.staffId && perms.subjectTeacherSubjectIds.size > 0) {
    return <TeacherPeriodView schoolId={schoolId} staffId={user.staffId} />;
  }

  if (user.role === "student" && user.userId) {
    const student = await prisma.student.findFirst({
      where: { userId: user.userId, schoolId },
      select: { id: true, currentClassId: true, isClassCaptain: true, isViceClassCaptain: true, firstName: true, lastName: true },
    });
    if (!student || (!student.isClassCaptain && !student.isViceClassCaptain)) {
      return <p className="font-body-md text-body-md text-on-surface-variant">Only class captains and vice captains can access the Period Tracker.</p>;
    }
    return <CaptainPeriodView schoolId={schoolId} studentId={student.id} classId={student.currentClassId!} />;
  }

  return <p className="font-body-md text-body-md text-on-surface-variant">No period tracker access for your role.</p>;
}
