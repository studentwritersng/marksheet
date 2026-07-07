import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ResultsView } from "./results-view";

export default async function ResultsPage(props: {
  searchParams: Promise<{ classId?: string; termId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="text-sm text-slate-500">Not authorised.</p>;
  }

  const [classes, terms] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      orderBy: { name: "asc" },
    }),
    prisma.term.findMany({
      where: { session: { schoolId: user.schoolId, isCurrent: true } },
      include: { session: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const selectedClassId = searchParams.classId || classes[0]?.id;
  const selectedTermId = searchParams.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;

  // Fetch computed results if available
  let subjectResults: any[] = [];
  let termResults: any[] = [];
  if (selectedClassId && selectedTermId) {
    [subjectResults, termResults] = await Promise.all([
      prisma.subjectResult.findMany({
        where: {
          termId: selectedTermId,
          student: { schoolId: user.schoolId, currentClassId: selectedClassId },
        },
        include: { subject: { select: { name: true } } },
        orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }],
      }),
      prisma.termResult.findMany({
        where: {
          termId: selectedTermId,
          student: { schoolId: user.schoolId, currentClassId: selectedClassId },
        },
        include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
        orderBy: { overallPosition: { sort: "asc", nulls: "last" } },
      }),
    ]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Results</h1>
      <p className="mt-1 text-sm text-slate-500">
        Compute weighted results per class and term, finalize, and generate report cards.
      </p>

      <div className="mt-6">
        <ResultsView
          schoolId={user.schoolId}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
          selectedClassId={selectedClassId ?? ""}
          selectedTermId={selectedTermId ?? ""}
          subjectResults={subjectResults.map((sr) => ({
            studentId: sr.studentId,
            subjectName: sr.subject.name,
            totalScore: sr.totalScore,
            grade: sr.grade,
            subjectPosition: sr.subjectPosition,
          }))}
          termResults={termResults.map((tr) => ({
            studentId: tr.studentId,
            studentName: `${tr.student.firstName} ${tr.student.lastName}`,
            admissionNumber: tr.student.admissionNumber,
            overallAverage: tr.overallAverage,
            overallPosition: tr.overallPosition,
            status: tr.status,
          }))}
        />
      </div>
    </div>
  );
}
