import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import type { EffectivePermissions } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SchoolLicenseBanner } from "@/components/school-license-banner";
import { resolveDisplayName } from "@/lib/auth/display-name";

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
  const displayName = await resolveDisplayName(user);

  if (user.role === "super_admin" || user.role === "platform_owner") {
    const [schools, configs] = await Promise.all([
      prisma.school.count(),
      prisma.aiProviderConfig.count(),
    ]);
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <section className="flex flex-col gap-stack-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0">
            {initial}
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {greeting()}, {displayName}
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
      select: { id: true, firstName: true, lastName: true, passportPhoto: true, currentClassId: true, isClassCaptain: true, isViceClassCaptain: true, currentClass: { select: { name: true, level: true } } },
    });
    const termResultCount = myStudent
      ? await prisma.termResult.count({ where: { studentId: myStudent.id } })
      : 0;
    const initial = myStudent ? `${myStudent.firstName.charAt(0)}${myStudent.lastName.charAt(0)}` : "S";

    // Fetch today's (or next day's) timetable
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isAfterSchool = currentHour > 15 || (currentHour === 15 && currentMinute > 0);
    // JS day: 0=Sun..6=Sat; our timetable: 0=Mon..4=Fri
    let jsDay = now.getDay();
    if (isAfterSchool) jsDay = jsDay >= 5 ? 0 : jsDay + 1; // wrap to Mon on weekends
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon..6=Sun
    const timetableDayName = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dayOfWeek];

    let timetableEntries: { period: string; startTime: string; endTime: string; subject: string; periodType: string }[] = [];
    if (myStudent?.currentClassId && dayOfWeek < 5) {
      const entries = await prisma.timetableEntry.findMany({
        where: { classId: myStudent.currentClassId, dayOfWeek },
        include: { period: { select: { name: true, startTime: true, endTime: true, periodType: true } }, subject: { select: { name: true } } },
        orderBy: { period: { startTime: "asc" } },
      });
      timetableEntries = entries.map((e) => ({
        period: e.period.name,
        startTime: e.period.startTime,
        endTime: e.period.endTime,
        subject: e.subject.name,
        periodType: e.period.periodType,
      }));
    }

    // Curriculum period tracker (only if addon active)
    const addonActive = await isAddonActive(schoolId, "Period Tracker");
    let curriculumStats: { subject: string; total: number; taught: number; pct: number }[] = [];
    let overallPct = 0;
    if (addonActive && myStudent?.currentClassId && myStudent.currentClass) {
      const currentTerm = await prisma.term.findFirst({
        where: { session: { schoolId, isCurrent: true }, isCurrent: true },
        select: { name: true },
      });
      if (currentTerm) {
        const classSubjects = await prisma.classSubject.findMany({
          where: { classId: myStudent.currentClassId },
          include: { subject: { select: { id: true, name: true } } },
        });
        for (const cs of classSubjects) {
          const total = await prisma.curriculumTopic.count({
            where: { classLevel: myStudent.currentClass.level, subject: cs.subject.name, term: currentTerm.name },
          });
          if (total === 0) continue;
          const taught = await prisma.taughtTopic.count({
            where: { classId: myStudent.currentClassId, subjectId: cs.subject.id, teacherMarked: true, captainMarked: true },
          });
          curriculumStats.push({
            subject: cs.subject.name,
            total,
            taught,
            pct: Math.round((taught / total) * 100),
          });
        }
        if (curriculumStats.length > 0) {
          const allTaught = curriculumStats.reduce((a, r) => a + r.taught, 0);
          const allTotal = curriculumStats.reduce((a, r) => a + r.total, 0);
          overallPct = Math.round((allTaught / allTotal) * 100);
        }
      }
    }

    return (
      <section className="flex flex-col gap-stack-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0 overflow-hidden">
            {myStudent?.passportPhoto ? <img src={myStudent.passportPhoto} alt="" className="w-full h-full object-cover" /> : initial}
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {greeting()}, {myStudent ? `${myStudent.firstName} ${myStudent.lastName}` : displayName}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {session ? `${session.label} · ${session.terms[0]?.name ?? ""} Term` : "No active session yet"}
              {myStudent?.currentClass ? ` · ${myStudent.currentClass.name}` : ""}
            </p>
            {(myStudent?.isClassCaptain || myStudent?.isViceClassCaptain) && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1 font-label-sm text-label-sm font-semibold text-amber-950 shadow-sm">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                {myStudent.isClassCaptain ? "Class Captain" : "Vice Captain"}
                {myStudent.currentClass?.name ? ` — ${myStudent.currentClass.name}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Today's Timetable */}
        {timetableEntries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">calendar_view_week</span>
                {isAfterSchool ? "Tomorrow's" : "Today's"} Timetable — {timetableDayName}
              </h3>
              <Link href="/my-timetable" className="font-label-sm text-label-sm text-primary hover:underline">View full →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-1.5 pr-2 text-left font-label-sm text-label-sm text-on-surface-variant">Time</th>
                    <th className="py-1.5 pr-2 text-left font-label-sm text-label-sm text-on-surface-variant">Period</th>
                    <th className="py-1.5 text-left font-label-sm text-label-sm text-on-surface-variant">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {timetableEntries.map((e, i) => (
                    <tr key={i} className="border-b border-outline-variant/50">
                      <td className="py-1.5 pr-2 text-on-surface-variant">{e.startTime}–{e.endTime}</td>
                      <td className="py-1.5 pr-2 text-on-surface">{e.period}</td>
                      <td className="py-1.5 font-medium text-on-surface">{e.subject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Curriculum Period Tracker */}
        {curriculumStats.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">checklist</span>
                Curriculum Progress
              </h3>
              <div className="flex items-center gap-1">
                <span className="font-label-sm text-label-sm font-semibold">{overallPct}%</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">covered</span>
              </div>
            </div>
            <div className="h-2 bg-surface-container rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overallPct}%`,
                  backgroundColor: overallPct >= 75 ? "#15803d" : overallPct >= 50 ? "#d97706" : "#dc2626",
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-1.5 pr-2 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
                    <th className="py-1.5 pr-2 font-label-sm text-label-sm text-on-surface-variant text-right">%</th>
                    <th className="py-1.5 font-label-sm text-label-sm text-on-surface-variant text-right">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {curriculumStats.map((r, i) => (
                    <tr key={i} className="border-b border-outline-variant/50">
                      <td className="py-1.5 pr-2 text-on-surface">{r.subject}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: r.pct >= 75 ? "#15803d" : r.pct >= 50 ? "#d97706" : "#dc2626" }}>{r.pct}%</td>
                      <td className="py-1.5 text-right text-on-surface-variant">{r.taught}/{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/curriculum-tracker" className="mt-3 block text-center font-label-sm text-label-sm text-primary hover:underline">View full tracker →</Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Term Results" value={termResultCount} icon="analytics" gradient="from-emerald-500 to-emerald-700" />
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5 hover:shadow-md transition-shadow col-span-1 sm:col-span-2">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-3">Quick Links</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/my-exams", icon: "quiz", label: "My Exams" },
                { href: "/my-results", icon: "analytics", label: "My Results" },
                { href: "/my-timetable", icon: "calendar_view_week", label: "Timetable" },
                { href: "/curriculum-tracker", icon: "checklist", label: "Curriculum" },
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

  const initials = displayName.charAt(0).toUpperCase();

  // ── Teacher dashboard ────────────────────────────────────────────────
  if (!admin) {
    const myStaff = user.staffId
      ? await prisma.staff.findFirst({ where: { id: user.staffId }, select: { fullName: true, image: true } })
      : await prisma.staff.findFirst({ where: { email: user.email, schoolId }, select: { fullName: true, image: true } });
    const myName = myStaff?.fullName ?? displayName;

    // All classes this teacher is involved with
    const myClassIds = [...new Set([...perms.classTeacherClassIds, ...perms.subjectTeacherClassIds])];
    const isClassTeacher = perms.classTeacherClassIds.size > 0;

    // Classes with student counts
    const myClasses = myClassIds.length > 0
      ? await prisma.class.findMany({
          where: { schoolId, id: { in: myClassIds } },
          select: { id: true, name: true, level: true, _count: { select: { students: { where: { status: "active" } } } } },
        })
      : [];

    // My subjects (referenced but not currently displayed as cards — useful for count)
    const mySubjectIds = [...new Set([...perms.subjectTeacherSubjectIds])];

    // Today's day-of-week for timetable
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeOfDay = now.getHours();
    const isAfterSchool = timeOfDay > 15 || (timeOfDay === 15 && now.getMinutes() > 0);
    let jsDay = now.getDay();
    if (isAfterSchool) jsDay = jsDay >= 5 ? 0 : jsDay + 1;
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..4=Fri

    const DAY_SHORT_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    // Stats for class teachers
    let myStudentCount = 0, signedInToday = 0, totalToday = 0;
    let myClassResults = 0, myClassAverage = 0, pendingRemarks = 0;
    let topStudents: { name: string; average: number }[] = [];
    let failingStudents = 0;
    let todayEntries: { period: string; startTime: string; endTime: string; subject: string }[] = [];

    if (isClassTeacher) {
      myStudentCount = await prisma.student.count({
        where: { schoolId, currentClassId: { in: [...perms.classTeacherClassIds] }, status: "active" },
      });

      // Today's attendance
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: { classId: { in: [...perms.classTeacherClassIds] }, date: { gte: today, lt: new Date(today.getTime() + 24*60*60*1000) } },
        select: { status: true },
      });
      totalToday = attendanceRecords.length;
      signedInToday = attendanceRecords.filter((r) => r.status === "present" || r.status === "late").length;

      // Today's timetable for my classes
      if (dayOfWeek < 5) {
        const entries = await prisma.timetableEntry.findMany({
          where: { classId: { in: myClassIds }, dayOfWeek },
          include: { period: { select: { name: true, startTime: true, endTime: true } }, subject: { select: { name: true } } },
          orderBy: { period: { startTime: "asc" } },
        });
        todayEntries = entries.map((e) => ({
          period: e.period.name, startTime: e.period.startTime, endTime: e.period.endTime, subject: e.subject.name,
        }));
      }

      // Current term results for my classes
      const currentTerm = session?.terms[0];
      if (currentTerm) {
        const termResults = await prisma.termResult.findMany({
          where: { termId: currentTerm.id, student: { currentClassId: { in: [...perms.classTeacherClassIds] } } },
          include: { student: { select: { firstName: true, lastName: true } } },
        });
        myClassResults = termResults.length;
        myClassAverage = termResults.length > 0
          ? Math.round(termResults.reduce((s, t) => s + (t.overallAverage ?? 0), 0) / termResults.length)
          : 0;
        topStudents = termResults
          .sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0))
          .slice(0, 3)
          .map((t) => ({ name: `${t.student.firstName} ${t.student.lastName}`, average: Math.round(t.overallAverage ?? 0) }));
        failingStudents = termResults.filter((t) => (t.overallAverage ?? 0) < 40).length;
      }

      // Pending remarks count
      pendingRemarks = await prisma.termResult.count({
        where: { term: { session: { schoolId, isCurrent: true } }, student: { currentClassId: { in: [...perms.classTeacherClassIds] } }, principalComment: "" },
      });
    }

    return (
      <section className="flex flex-col gap-stack-lg">
        {/* Greeting */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0 overflow-hidden">
            {myStaff?.image ? <img src={myStaff.image} alt="" className="w-full h-full object-cover" /> : myName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {greeting()}, {myName}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {school?.name ?? "Dashboard"} &middot;{" "}
              {session ? `${session.label} · ${session.terms[0]?.name ?? ""} Term` : "No active session yet"}
            </p>
          </div>
        </div>

        {/* My Classes */}
        {myClasses.length > 0 && (
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">
              {isClassTeacher ? "Class Teacher — " : ""}My Classes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myClasses.map((cls) => (
                <div key={cls.id} className="bg-white rounded-2xl border border-outline-variant shadow-sm p-4">
                  <p className="font-headline-sm text-headline-sm text-on-surface">{cls.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{cls._count.students} student{cls._count.students !== 1 ? "s" : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {isClassTeacher && perms.classTeacherClassIds.has(cls.id) && (
                      <span className="text-[10px] font-semibold bg-[#002046] text-white px-2 py-0.5 rounded-full">Class Teacher</span>
                    )}
                    {perms.subjectTeacherClassIds.has(cls.id) && (
                      <span className="text-[10px] font-semibold bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full">Subject Teacher</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isClassTeacher && (
            <>
              <StatCard label="My Students" value={myStudentCount} icon="group" gradient="from-emerald-500 to-emerald-700" />
              {totalToday > 0
                ? <StatCard label="Today's Attendance" value={signedInToday} icon="fact_check" gradient="from-sky-500 to-sky-700" sublabel={`of ${totalToday}`} />
                : <StatCard label="Today's Attendance" value={0} icon="fact_check" gradient="from-neutral-400 to-neutral-600" sublabel="No records yet" />
              }
              <StatCard label="Term Results" value={myClassResults} icon="analytics" gradient="from-indigo-500 to-indigo-700" />
              {pendingRemarks > 0 && <StatCard label="Pending Remarks" value={pendingRemarks} icon="rate_review" gradient="from-orange-500 to-orange-700" />}
            </>
          )}
          {!isClassTeacher && (
            <>
              <StatCard label="Classes" value={myClassIds.length} icon="school" gradient="from-amber-500 to-amber-700" />
              <StatCard label="Subjects" value={mySubjectIds.length} icon="book" gradient="from-rose-500 to-rose-700" />
              <StatCard label="Lesson Notes" value={lessonNotes} icon="note" gradient="from-cyan-500 to-cyan-700" />
              <StatCard label="Term Results" value={termResults} icon="analytics" gradient="from-indigo-500 to-indigo-700" />
            </>
          )}
        </div>

        {/* Today's timetable for my classes */}
        {todayEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
            <h3 className="font-label-md text-label-md text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">calendar_view_week</span>
              Today's Schedule ({["Mon","Tue","Wed","Thu","Fri"][dayOfWeek]})
            </h3>
            <div className="space-y-2">
              {todayEntries.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-outline-variant/30 last:border-0">
                  <span className="font-body-sm text-on-surface-variant w-32 shrink-0">{e.period}</span>
                  <span className="flex-1 font-body-sm text-on-surface">{e.subject}</span>
                  <span className="font-body-sm text-on-surface-variant text-xs">{e.startTime}–{e.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results at a glance + pending remarks */}
        {isClassTeacher && myClassResults > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-outline-variant shadow-sm p-5">
              <h3 className="font-label-md text-label-md text-on-surface mb-3">My Class Performance</h3>
              <p className="text-3xl font-bold text-on-surface mb-1">{myClassAverage}%</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">Class average this term</p>
              {topStudents.length > 0 && (
                <div className="space-y-1.5">
                  {topStudents.map((t, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{t.name}</span>
                      <span className="font-semibold">{t.average}%</span>
                    </div>
                  ))}
                </div>
              )}
              {failingStudents > 0 && (
                <p className="mt-3 text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                  ⚠ {failingStudents} student{failingStudents !== 1 ? "s" : ""} below 40%
                </p>
              )}
            </div>
            {pendingRemarks > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-label-md text-label-md text-amber-800 mb-1">Pending Remarks</h3>
                  <p className="text-2xl font-bold text-amber-900">{pendingRemarks}</p>
                  <p className="font-body-sm text-amber-700 mt-1">
                    student{pendingRemarks !== 1 ? "s" : ""} waiting for principal remarks
                  </p>
                </div>
                <Link href="/results/remarks" className="mt-4 text-sm font-medium text-amber-700 hover:text-amber-900">
                  Go to remarks →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Scope */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-3">Your scope</h3>
          <div className="flex flex-wrap gap-2">
            {perms.subjectTeacherSubjectIds.size > 0 && (
              <Link href="/curriculum-tracker" className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-container/10 px-3 py-1.5 rounded-lg hover:bg-primary-container/20">
                <span className="material-symbols-outlined text-[16px]">checklist</span>
                Curriculum Tracker
              </Link>
            )}
            {perms.subjectTeacherSubjectIds.size > 0 && (
              <Link href="/lesson-notes" className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-container/10 px-3 py-1.5 rounded-lg hover:bg-primary-container/20">
                <span className="material-symbols-outlined text-[16px]">note</span>
                Lesson Notes
              </Link>
            )}
            {isClassTeacher && (
              <Link href="/students" className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-container/10 px-3 py-1.5 rounded-lg hover:bg-primary-container/20">
                <span className="material-symbols-outlined text-[16px]">group</span>
                My Students
              </Link>
            )}
            {isClassTeacher && perms.classTeacherClassIds.size > 0 && (
              <Link href="/attendance" className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-container/10 px-3 py-1.5 rounded-lg hover:bg-primary-container/20">
                <span className="material-symbols-outlined text-[16px]">fact_check</span>
                Today's Attendance
              </Link>
            )}
            {perms.assignments.length === 0 && (
              <p className="font-body-sm text-body-sm text-error bg-error-container px-3 py-2 rounded">
                You have no active assignments yet. Contact your school administrator.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Admin dashboard (unchanged from before) ──────────────────────
  return (
    <section className="flex flex-col gap-stack-lg">
      {/* Greeting */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#002046] flex items-center justify-center text-white font-headline-sm text-headline-sm shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {greeting()}, {displayName}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {school?.name ?? "Dashboard"} &middot;{" "}
            {session ? `${session.label} · ${session.terms[0]?.name ?? ""} Term` : "No active session yet"}
          </p>
        </div>
      </div>

      {admin && <SchoolLicenseBanner schoolId={schoolId} />}
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

      {/* Period Tracker coverage (all roles) */}
      <PeriodCoverageWidget schoolId={schoolId} perms={perms} user={user} />

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
    </section>
  );
}

function StatCard({ label, value, icon, gradient, sublabel }: {
  label: string; value: number | string; icon: string; gradient: string; sublabel?: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-label-sm text-label-sm text-white/80">{label}</span>
        <span className="material-symbols-outlined text-[22px] text-white/60">{icon}</span>
      </div>
      <div className="font-headline-lg text-headline-lg font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sublabel && <div className="font-body-sm text-body-sm text-white/70 mt-1">{sublabel}</div>}
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

async function PeriodCoverageWidget({
  schoolId, perms, user,
}: {
  schoolId: string; perms: EffectivePermissions; user: SessionPayload;
}) {
  const addonActive = await isAddonActive(schoolId, "Period Tracker");
  if (!addonActive) return null;

  let classIds: string[] = [];
  if (user.role === "staff" && user.staffId) {
    classIds = Array.from(perms.subjectTeacherClassIds);
  } else if (perms.isSuperAdmin || perms.isSchoolAdmin) {
    const classes = await prisma.class.findMany({ where: { schoolId, archived: false }, select: { id: true } });
    classIds = classes.map((c) => c.id);
  } else if (user.role === "student" && user.userId) {
    const s = await prisma.student.findFirst({
      where: { userId: user.userId, schoolId },
      select: { currentClassId: true, isClassCaptain: true, isViceClassCaptain: true },
    });
    if (s?.currentClassId && (s.isClassCaptain || s.isViceClassCaptain)) {
      classIds = [s.currentClassId];
    }
  }
  if (classIds.length === 0) return null;

  const [currentTerm, classes] = await Promise.all([
    prisma.term.findFirst({
      where: { session: { schoolId, isCurrent: true }, isCurrent: true },
      select: { name: true },
    }),
    prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, level: true, name: true } }),
  ]);
  if (!currentTerm) return null;

  const rows: { className: string; subjectName: string; total: number; taught: number; pct: number }[] = [];
  for (const cls of classes) {
    const classSubjects = await prisma.classSubject.findMany({
      where: { classId: cls.id },
      include: { subject: { select: { name: true } } },
    });
    for (const cs of classSubjects) {
      const total = await prisma.curriculumTopic.count({
        where: { classLevel: cls.level, subject: cs.subject.name, term: currentTerm.name },
      });
      if (total === 0) continue;
      const taught = await prisma.taughtTopic.count({
        where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: true },
      });
      rows.push({
        className: cls.name,
        subjectName: cs.subject.name,
        total,
        taught,
        pct: Math.round((taught / total) * 100),
      });
    }
  }

  if (rows.length === 0) return null;

  const allTaught = rows.reduce((a, r) => a + r.taught, 0);
  const allTotal = rows.reduce((a, r) => a + r.total, 0);
  const overallPct = Math.round((allTaught / allTotal) * 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">checklist</span>
          Period Tracker Coverage
        </h3>
        <div className="flex items-center gap-1">
          <span className="font-label-sm text-label-sm font-semibold">{overallPct}%</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">complete</span>
        </div>
      </div>
      <div className="h-2 bg-surface-container rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${overallPct}%`,
            backgroundColor: overallPct >= 75 ? "#15803d" : overallPct >= 50 ? "#d97706" : "#dc2626",
          }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="py-1.5 pr-2 font-label-sm text-label-sm text-on-surface-variant">Class</th>
              <th className="py-1.5 pr-2 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
              <th className="py-1.5 pr-2 font-label-sm text-label-sm text-on-surface-variant text-right">%</th>
              <th className="py-1.5 font-label-sm text-label-sm text-on-surface-variant text-right">Done</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r, i) => (
              <tr key={i} className="border-b border-outline-variant/50">
                <td className="py-1.5 pr-2 text-on-surface">{r.className}</td>
                <td className="py-1.5 pr-2 text-on-surface">{r.subjectName}</td>
                <td className="py-1.5 pr-2 text-right font-semibold" style={{ color: r.pct >= 75 ? "#15803d" : r.pct >= 50 ? "#d97706" : "#dc2626" }}>{r.pct}%</td>
                <td className="py-1.5 text-right text-on-surface-variant">{r.taught}/{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <p className="mt-2 text-center text-xs text-on-surface-variant">+{rows.length - 10} more</p>
      )}
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
