import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function ReportCardPage(props: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ termId: string }>;
}) {
  const { studentId } = await props.params;
  const { termId } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [student, term, school] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId ?? undefined },
      include: { currentClass: { select: { name: true, level: true } } },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      include: { session: true },
    }),
    user.schoolId ? prisma.school.findUnique({ where: { id: user.schoolId } }) : null,
  ]);
  if (!student || !term) notFound();

  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId, termId },
    include: { subject: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  const termResult = await prisma.termResult.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      {/* Print button */}
      <div className="mb-6 no-print">
        <button
          onClick={() => window.print()}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
        >
          Print / Save PDF
        </button>
        <a
          href="/results"
          className="ml-3 font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Back to results
        </a>
      </div>

      {/* Report card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="border-b-2 border-on-surface pb-4 text-center">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {school?.name ?? "Marksheet School"}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {term.session.label} · {term.name} Term · Report Card
          </p>
        </div>

        {/* Student info */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-label-md text-label-md text-on-surface">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-on-surface-variant">Admission: {student.admissionNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-on-surface">Class: {student.currentClass?.name ?? "—"}</p>
            {termResult?.overallPosition && (
              <p className="text-on-surface">
                Position: <span className="font-semibold">{termResult.overallPosition}</span>
              </p>
            )}
          </div>
        </div>

        {/* Subject results table */}
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant font-label-sm text-label-sm uppercase text-on-surface-variant">
              <th className="pb-2">Subject</th>
              <th className="pb-2">Score</th>
              <th className="pb-2">Grade</th>
              <th className="pb-2">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {subjectResults.map((sr) => (
              <tr key={sr.id}>
                <td className="py-2 font-label-md text-label-md text-on-surface">{sr.subject.name}</td>
                <td className="py-2 text-on-surface">{sr.totalScore?.toFixed(1) ?? "—"}</td>
                <td className="py-2">
                  <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface">
                    {sr.grade ?? "—"}
                  </span>
                </td>
                <td className="py-2 text-on-surface-variant">#{sr.subjectPosition ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Overall */}
        <div className="mt-6 border-t border-outline-variant pt-4 text-right">
          <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Average: {termResult?.overallAverage?.toFixed(1) ?? "—"}%
          </p>
        </div>

        {/* Comments */}
        <div className="mt-6 space-y-3 border-t border-outline-variant pt-4">
          {termResult?.teacherComment && (
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Teacher&apos;s comment</p>
              <p className="font-body-sm text-body-sm text-on-surface">{termResult.teacherComment}</p>
            </div>
          )}
          {termResult?.principalComment && (
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Principal&apos;s comment</p>
              <p className="font-body-sm text-body-sm text-on-surface">{termResult.principalComment}</p>
            </div>
          )}
          {termResult?.affectiveRatings && (
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Affective ratings</p>
              <pre className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                {JSON.stringify(termResult.affectiveRatings, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Verification code */}
        <div className="mt-6 border-t border-outline-variant pt-4 text-center font-label-sm text-label-sm text-on-surface-variant">
          {termResult?.status === "finalised" && (
            <p>Verified via Marksheet verification portal with code provided separately.</p>
          )}
        </div>
      </div>
    </div>
  );
}
