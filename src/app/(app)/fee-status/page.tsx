import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getStudentFeeSummary, getStudentFeeSummaryBatch, type StudentFeeSummary } from "@/lib/fees/bursary";
import { formatNaira } from "@/lib/format";
import { FeeStatusTable } from "./fee-status-table";
import { TermSelector } from "./term-selector";
import { ClassSelector } from "./class-selector";
import { FeeStatusBadge } from "@/components/fee-status-badge";

export default async function FeeStatusPage(props: {
  searchParams: Promise<{ termId?: string; classId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);

  const isAdmin = perms.isSuperAdmin || perms.isSchoolAdmin || perms.isFeeStatusManager;

  // ── Student view ─────────────────────────────────────────────────────────
  if (user.role === "student") {
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      include: { currentClass: { select: { name: true } }, school: { select: { id: true } } },
    });
    if (!student) {
      return <p className="font-body-sm text-body-sm text-on-surface-variant">Student record not found.</p>;
    }

    const currentSession = await prisma.session.findFirst({
      where: { schoolId: student.school.id, isCurrent: true },
      include: { terms: { orderBy: { name: "asc" } } },
    });
    const activeTerm = currentSession?.terms.find((t) => t.isCurrent) ?? currentSession?.terms[0];

    // Fetch fee status for ALL terms so the student sees their history
    const termIds = currentSession?.terms.map((t) => t.id) ?? [];
    const feeStatuses = termIds.length
      ? await prisma.feeStatus.findMany({
          where: { studentId: student.id, termId: { in: termIds } },
        })
      : [];
    const feeMap = new Map(feeStatuses.map((fs) => [fs.termId, fs]));

    const summaries: Record<string, StudentFeeSummary> = {};
    for (const termId of termIds) {
      summaries[termId] = await getStudentFeeSummary(student.id, termId);
    }

    return (
      <section className="flex flex-col gap-6 max-w-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Fee Status</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Your payment clearance status as recorded by the school office.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              {student.firstName} {student.lastName}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {student.currentClass?.name ?? "—"} · {student.admissionNumber}
            </p>
          </div>

          {!currentSession || currentSession.terms.length === 0 ? (
            <p className="px-5 py-4 font-body-sm text-body-sm text-on-surface-variant">
              No current session configured.
            </p>
          ) : (
            <div className="divide-y divide-outline-variant">
              {currentSession.terms.map((term) => {
                const fs = feeMap.get(term.id);
                const sum = summaries[term.id];
                return (
                  <div key={term.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="font-label-md text-label-md text-on-surface">
                        {term.name} Term
                        {term.isCurrent && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </p>
                      {sum && <FeeStatusBadge status={sum.status} />}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {currentSession.label}
                    </p>
                    {fs?.notes && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 italic">
                        Note: {fs.notes}
                      </p>
                    )}
                    {sum?.hasStructure ? (
                      <dl className="mt-3 grid grid-cols-3 gap-3">
                        <div>
                          <dt className="font-label-sm text-label-sm text-on-surface-variant">Expected</dt>
                          <dd className="font-headline-sm text-headline-sm text-on-surface">{formatNaira(sum.expected)}</dd>
                        </div>
                        <div>
                          <dt className="font-label-sm text-label-sm text-on-surface-variant">Paid</dt>
                          <dd className="font-headline-sm text-headline-sm text-on-surface">{formatNaira(sum.paid)}</dd>
                        </div>
                        <div>
                          <dt className="font-label-sm text-label-sm text-on-surface-variant">Balance</dt>
                          <dd className="font-headline-sm text-headline-sm text-on-surface">{formatNaira(sum.balance)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant italic">
                        No fee structure set for this class/term.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
          If your status is incorrect, please contact the school office.
        </p>
      </section>
    );
  }

  // ── Admin / fee manager view ──────────────────────────────────────────────
  if (!isAdmin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const currentSession = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    include: { terms: { orderBy: { name: "asc" } } },
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const activeTerm = currentSession?.terms.find((t) => t.isCurrent) ?? currentSession?.terms[0];
  const selectedTermId = searchParams.termId || activeTerm?.id;
  const classId = searchParams.classId?.trim() || undefined;

  if (!selectedTermId) {
    return (
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Fee Status</h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          No current session/terms configured. Set up sessions and terms first.
        </p>
      </div>
    );
  }

  const [students, feeStatuses, summaryMap] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId: user.schoolId,
        status: "active",
        ...(classId ? { currentClassId: classId } : {}),
      },
      include: { currentClass: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.feeStatus.findMany({
      where: { termId: selectedTermId },
    }),
    getStudentFeeSummaryBatch(user.schoolId, selectedTermId),
  ]);

  const feeStatusMap = new Map(feeStatuses.map((fs) => [fs.studentId, fs]));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Fee Status Check</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Admin-set flag to gate exam access and result release. Contains no financial figures.
      </p>

      {currentSession && (
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-on-surface">Term:</span>
            <TermSelector
              terms={currentSession.terms.map((t) => ({ id: t.id, name: t.name }))}
              selectedTermId={selectedTermId}
              classId={classId}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-on-surface">Class:</span>
            <ClassSelector
              classes={classes}
              selectedClassId={classId ?? ""}
              selectedTermId={selectedTermId}
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <FeeStatusTable
          selectedTermId={selectedTermId}
          students={students.map((s) => {
            const fs = feeStatusMap.get(s.id);
            const sum = summaryMap.get(s.id);
            return {
              id: s.id,
              admissionNumber: s.admissionNumber,
              firstName: s.firstName,
              lastName: s.lastName,
              className: s.currentClass?.name ?? "—",
              status: fs?.status ?? "not_cleared",
              notes: fs?.notes ?? "",
              expected: sum?.expected ?? 0,
              paid: sum?.paid ?? 0,
              balance: sum?.balance ?? 0,
              hasStructure: sum?.hasStructure ?? false,
            };
          })}
        />
      </div>
    </div>
  );
}
