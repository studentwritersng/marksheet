import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SchoolLicenseBanner } from "@/components/school-license-banner";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);

  const schoolId = user.schoolId!;

  if (user.role === "super_admin" || user.role === "platform_owner") {
    const [schools, configs] = await Promise.all([
      prisma.school.count(),
      prisma.aiProviderConfig.count(),
    ]);
    const initial = user.email.charAt(0).toUpperCase();
    return (
      <section className="flex flex-col gap-stack-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0">
            {initial}
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {greeting()}, {user.email.split("@")[0]}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">Super Admin — platform-level management</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Schools" value={schools} icon="domain" gradient="from-[#1e3a5f] to-[#002046]" />
          <StatCard label="AI Provider Configs" value={configs} icon="settings" gradient="from-[#1e3a5f] to-[#002046]" />
        </div>
      </section>
    );
  }

  const [students, classes, staff, subjects, session, school, lessonNotes, exams, termResults] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.class.count({ where: { schoolId, archived: false } }),
    prisma.staff.count({ where: { schoolId } }),
    prisma.subject.count({ where: { schoolId } }),
    prisma.session.findFirst({
      where: { schoolId, isCurrent: true },
      include: { terms: { where: { isCurrent: true } } },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, logo: true } }),
    prisma.lessonNote.count({ where: { schoolId } }),
    prisma.exam.count({ where: { schoolId } }),
    prisma.termResult.count({ where: { term: { session: { schoolId, isCurrent: true } } } }),
  ]);

  const admin = canManageSchool(perms);

  if (user.role === "student") {
    const myStudent = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { id: true, firstName: true, lastName: true, passportPhoto: true, currentClass: { select: { name: true } } },
    });
    const termResultCount = myStudent
      ? await prisma.termResult.count({ where: { studentId: myStudent.id } })
      : 0;
    const initial = myStudent ? `${myStudent.firstName.charAt(0)}${myStudent.lastName.charAt(0)}` : "S";

    return (
      <section className="flex flex-col gap-stack-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0 overflow-hidden">
            {myStudent?.passportPhoto ? <img src={myStudent.passportPhoto} alt="" className="w-full h-full object-cover" /> : initial}
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {greeting()}, {myStudent ? myStudent.firstName : "Student"}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {session ? `${session.label} · ${session.terms[0]?.name ?? ""} Term` : "No active session yet"}
              {myStudent?.currentClass ? ` · ${myStudent.currentClass.name}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Term Results" value={termResultCount} icon="analytics" gradient="from-emerald-500 to-emerald-700" />
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 hover:shadow-md transition-shadow col-span-1 sm:col-span-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-3">Quick Links</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/my-exams", icon: "quiz", label: "My Exams" },
                { href: "/my-results", icon: "analytics", label: "My Results" },
                { href: "/my-timetable", icon: "calendar_view_week", label: "Timetable" },
                { href: "/settings/profile", icon: "person", label: "Profile" },
              ].map(({ href, icon, label }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#002046]">{icon}</span>
                  <span className="font-label-sm text-label-sm text-on-surface">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const initials = user.email.charAt(0).toUpperCase();

  return (
    <section className="flex flex-col gap-stack-lg">
      {/* Greeting */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {greeting()}, {user.email.split("@")[0]}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {school?.name ?? "Dashboard"} &middot;{" "}
            {session ? `${session.label} · ${session.terms[0]?.name ?? ""} Term` : "No active session yet"}
          </p>
        </div>
      </div>

      <SchoolLicenseBanner schoolId={schoolId} />
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {admin && (
          <StatCard label="Active Students" value={students} icon="group" gradient="from-emerald-500 to-emerald-700" />
        )}
        <StatCard label="Classes" value={classes} icon="school" gradient="from-amber-500 to-amber-700" />
        {admin && (
          <StatCard label="Staff" value={staff} icon="badge" gradient="from-violet-500 to-violet-700" />
        )}
        {admin && (
          <StatCard label="Subjects" value={subjects} icon="book" gradient="from-rose-500 to-rose-700" />
        )}
        <StatCard label="Lesson Notes" value={lessonNotes} icon="note" gradient="from-cyan-500 to-cyan-700" />
        {admin && (
          <StatCard label="Exams" value={exams} icon="quiz" gradient="from-orange-500 to-orange-700" />
        )}
        <StatCard label="Term Results" value={termResults} icon="analytics" gradient="from-indigo-500 to-indigo-700" />
      </div>

      {/* Calendar + charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar widget */}
        <Link href="/timetable"
          className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 hover:shadow-md hover:border-primary transition-all group col-span-1"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-label-md text-label-md text-on-surface-variant">Calendar</h3>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
          </div>
          <MiniCalendar />
          <p className="mt-2 font-label-sm text-label-sm text-primary text-center">View full timetable &rarr;</p>
        </Link>

        {/* Subject distribution bar chart (admin only) */}
        {admin && (
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 col-span-1 lg:col-span-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-3">Subject Distribution</h3>
            <SubjectBarChart schoolId={schoolId} />
          </div>
        )}
      </div>

      {/* Non-admin scope */}
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

function StatCard({ label, value, icon, gradient }: {
  label: string; value: number; icon: string; gradient: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-label-sm text-label-sm text-white/80">{label}</span>
        <span className="material-symbols-outlined text-[22px] text-white/60">{icon}</span>
      </div>
      <div className="font-headline-lg text-headline-lg font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today;
    cells.push(
      <div key={d} className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium
        ${isToday ? "bg-[#002046] text-white" : "text-on-surface hover:bg-surface-container"}`}>
        {d}
      </div>
    );
  }

  return (
    <div>
      <div className="text-center font-label-sm text-label-sm text-on-surface mb-2">{monthNames[month]} {year}</div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[10px] font-semibold text-on-surface-variant uppercase py-1">{d}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}

async function SubjectBarChart({ schoolId }: { schoolId: string }) {
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    select: { name: true, _count: { select: { classSubjects: true } } },
    orderBy: { classSubjects: { _count: "desc" } },
    take: 8,
  });

  if (subjects.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No subjects yet.</p>;
  }

  const maxCount = Math.max(...subjects.map((s) => s._count.classSubjects), 1);

  const colors = ["#002046", "#1e3a5f", "#2d4a7a", "#3d5a8f", "#5a7aa0", "#7a9ab8", "#9abacf", "#bad5e5"];

  return (
    <div className="space-y-2">
      {subjects.map((s, idx) => (
        <div key={s.name} className="flex items-center gap-3">
          <span className="w-28 font-body-sm text-body-sm text-on-surface truncate text-right shrink-0">{s.name}</span>
          <div className="flex-1 h-5 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(4, (s._count.classSubjects / maxCount) * 100)}%`,
                backgroundColor: colors[idx % colors.length],
              }}
            />
          </div>
          <span className="w-6 font-label-sm text-label-sm text-on-surface-variant text-right shrink-0">{s._count.classSubjects}</span>
        </div>
      ))}
    </div>
  );
}
