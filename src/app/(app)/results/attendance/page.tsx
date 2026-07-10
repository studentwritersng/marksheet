import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AttendanceForm } from "./form";

export default async function AttendancePage(props: {
  searchParams: Promise<{ classId?: string; termId?: string }>;
}) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [classes, terms] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.term.findMany({
      where: { session: { schoolId: user.schoolId, isCurrent: true } },
      include: { session: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const selectedClassId = sp.classId || classes[0]?.id;
  const selectedTermId = sp.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;

  let students: { id: string; firstName: string; lastName: string; admissionNumber: string }[] = [];
  let termResults: { studentId: string; attendanceSummary: any }[] = [];

  if (selectedClassId && selectedTermId) {
    [students, termResults] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId: user.schoolId, currentClassId: selectedClassId, status: "active" },
        orderBy: { lastName: "asc" },
      }),
      prisma.termResult.findMany({
        where: { termId: selectedTermId, student: { currentClassId: selectedClassId } },
        select: { studentId: true, attendanceSummary: true },
      }),
    ]);
  }

  const attendanceMap = Object.fromEntries(termResults.map((r) => [r.studentId, r.attendanceSummary as Record<string, number | string> ?? {}]));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Attendance</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Record attendance summaries per student for the term. These appear on report cards.
      </p>
      <div className="mt-6">
        <AttendanceForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
          selectedClassId={selectedClassId ?? ""}
          selectedTermId={selectedTermId ?? ""}
          students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, admissionNumber: s.admissionNumber }))}
          existingAttendance={attendanceMap}
        />
      </div>
    </div>
  );
}
