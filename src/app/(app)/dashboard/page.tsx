import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);

  if (user.role === "super_admin") {
    const [schools, configs] = await Promise.all([
      prisma.school.count(),
      prisma.aiProviderConfig.count(),
    ]);
    return (
      <section className="flex flex-col gap-stack-lg">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Platform Overview
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Super Admin — platform-level management.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DashboardStat label="Schools" value={schools} icon="domain" />
          <DashboardStat label="AI Provider Configs" value={configs} icon="settings" />
        </div>
      </section>
    );
  }

  const schoolId = user.schoolId!;
  const [students, classes, staff, subjects, session, school] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.class.count({ where: { schoolId, archived: false } }),
    prisma.staff.count({ where: { schoolId } }),
    prisma.subject.count({ where: { schoolId } }),
    prisma.session.findFirst({
      where: { schoolId, isCurrent: true },
      include: { terms: { where: { isCurrent: true } } },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ]);

  const admin = canManageSchool(perms);

  if (user.role === "student") {
    const myStudent = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true } } },
    });
    const termResultCount = myStudent
      ? await prisma.termResult.count({ where: { studentId: myStudent.id } })
      : 0;

    return (
      <section className="flex flex-col gap-stack-lg">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Welcome, {myStudent ? `${myStudent.firstName} ${myStudent.lastName}` : "Student"}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {session
              ? `${session.label} · ${session.terms[0]?.name ?? ""} Term`
              : "No active session yet"}
            {myStudent?.currentClass ? ` · ${myStudent.currentClass.name}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardStat label="Term Results" value={termResultCount} icon="analytics" color="green" />
          <div className="card-light card-light-blue hover:border-primary transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-md text-label-md text-on-surface-variant">Quick Links</span>
              <span className="material-symbols-outlined text-[20px] text-[#002046]">link</span>
            </div>
            <div className="mt-3 space-y-2">
              <a href="/my-results" className="flex items-center gap-2 font-label-sm text-label-sm text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">analytics</span> View My Results
              </a>
              <a href="/my-timetable" className="flex items-center gap-2 font-label-sm text-label-sm text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">calendar_view_week</span> My Timetable
              </a>
              <a href="/fee-status" className="flex items-center gap-2 font-label-sm text-label-sm text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span> Fee Status
              </a>
              <a href="/settings/profile" className="flex items-center gap-2 font-label-sm text-label-sm text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">person</span> My Profile
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-stack-lg">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Welcome back
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {session
              ? `${session.label} · ${session.terms[0]?.name ?? ""} Term`
              : "No active session yet"}
          </p>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Session / Term card */}
        <div className="col-span-1 sm:col-span-2 card-light card-light-blue flex flex-col justify-between relative overflow-hidden group hover:border-primary transition-colors">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[120px] translate-x-4 -translate-y-4 text-[#002046]">calendar_clock</span>
          </div>
          <div className="flex items-center gap-2 text-[#002046] mb-4 z-10">
            <span className="material-symbols-outlined text-[18px]">event</span>
            <span className="font-label-md text-label-md">Academic Period</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 z-10">
            <div>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Session</span>
              <div className="font-display text-display text-primary mt-1">
                {session?.label ?? "—"}
              </div>
            </div>
            <div>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">Term</span>
              <div className="font-display text-display text-primary mt-1">
                {session?.terms[0]?.name ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {admin && (
          <DashboardStat label="Active Students" value={students} icon="group" color="green" />
        )}
        <DashboardStat label="Classes" value={classes} icon="school" color="amber" />
        {admin && <DashboardStat label="Staff" value={staff} icon="badge" color="purple" />}
        {admin && <DashboardStat label="Subjects" value={subjects} icon="book" color="rose" />}
      </div>

      {!admin && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-4">Your scope</h3>
          <div className="space-y-2">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Subject-teaching in {perms.subjectTeacherClassIds.size} class(es)
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Class teacher for {perms.classTeacherClassIds.size} class(es)
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              HOD for {perms.hodSubjectIds.size} subject(s)
            </p>
            {perms.assignments.length === 0 && (
              <p className="font-body-sm text-body-sm text-error bg-error-container px-3 py-2 rounded mt-3">
                You have no active assignments yet. Contact your school administrator.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardStat({
  label,
  value,
  icon,
  color = "blue",
}: {
  label: string;
  value: number;
  icon: string;
  color?: "blue" | "green" | "amber" | "rose" | "purple";
}) {
  const colorMap = {
    blue: "card-light-blue",
    green: "card-light-green",
    amber: "card-light-amber",
    rose: "card-light-rose",
    purple: "card-light-purple",
  };

  return (
    <div className={`card-light ${colorMap[color]} hover:border-primary transition-colors`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
        <span className="material-symbols-outlined text-[20px] text-[#002046]">{icon}</span>
      </div>
      <div className="font-headline-lg text-headline-lg text-on-surface mt-2">{value}</div>
    </div>
  );
}
