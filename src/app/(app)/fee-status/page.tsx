import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { FeeStatusTable } from "./fee-status-table";
import { TermSelector } from "./term-selector";

export default async function FeeStatusPage(props: {
  searchParams: Promise<{ termId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);

  const authorized = perms.isSuperAdmin || perms.isSchoolAdmin || perms.isFeeStatusManager;
  if (!authorized || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  // Get current active session
  const currentSession = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    include: { terms: { orderBy: { name: "asc" } } },
  });

  const activeTerm = currentSession?.terms.find((t) => t.isCurrent) ?? currentSession?.terms[0];
  const selectedTermId = searchParams.termId || activeTerm?.id;

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

  // Retrieve students and their fee status for the selected term
  const [students, feeStatuses] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "active" },
      include: { currentClass: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.feeStatus.findMany({
      where: { termId: selectedTermId },
    }),
  ]);

  const feeStatusMap = new Map(feeStatuses.map((fs) => [fs.studentId, fs]));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Fee Status Check</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Admin-set flag to gate exam access and result release. Contains no financial figures.
      </p>

      {currentSession && (
        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-on-surface">Term:</span>
            <TermSelector
              terms={currentSession.terms.map((t) => ({ id: t.id, name: t.name }))}
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
            return {
              id: s.id,
              admissionNumber: s.admissionNumber,
              firstName: s.firstName,
              lastName: s.lastName,
              className: s.currentClass?.name ?? "—",
              status: fs?.status ?? "not_cleared",
              notes: fs?.notes ?? "",
            };
          })}
        />
      </div>
    </div>
  );
}
