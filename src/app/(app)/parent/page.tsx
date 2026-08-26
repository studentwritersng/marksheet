import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getStudentFeeSummary } from "@/lib/fees/bursary";
import { formatNaira } from "@/lib/format";
import { FeeStatusBadge } from "@/components/fee-status-badge";

export default async function ParentDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  const guardians = await prisma.guardian.findMany({
    where: { parentUserId: user.userId, student: { schoolId: user.schoolId ?? undefined } },
    include: {
      student: {
        include: {
          currentClass: { select: { name: true } },
          termResults: {
            include: { term: { include: { session: true } } },
            orderBy: { term: { session: { label: "desc" } } },
            take: 3,
          },
        },
      },
    },
  });

  // Resolve the active term so we can compute a per-ward fee summary.
  const currentSession = user.schoolId
    ? await prisma.session.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        include: { terms: { orderBy: { name: "asc" } } },
      })
    : null;
  const activeTerm =
    currentSession?.terms.find((t) => t.isCurrent) ?? currentSession?.terms[0] ?? null;

  const summaries = await Promise.all(
    guardians.map((g) =>
      activeTerm ? getStudentFeeSummary(g.student.id, activeTerm.id) : null,
    ),
  );

  if (guardians.length === 0) {
    return (
      <div className="flex flex-col gap-stack-lg">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Wards</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">No wards linked to your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Wards</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">View your wards&apos; academic progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guardians.map((g, i) => {
          const s = g.student;
          const latestResult = s.termResults[0];
          const summary = summaries[i];
          return (
            <Link
              key={s.id}
              href={`/parent/ward/${s.id}`}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px] text-on-primary-fixed" style={{fontVariationSettings: "'FILL' 1"}}>person</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{s.firstName} {s.lastName}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {s.currentClass?.name ?? "No class"} · {s.admissionNumber}
                  </p>
                </div>
              </div>
              {latestResult && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded font-label-sm text-label-sm">
                    Avg: {latestResult.overallAverage != null ? Math.round(latestResult.overallAverage) : "—"}%
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Pos: #{latestResult.overallPosition ?? "—"}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {latestResult.term.name} ({latestResult.term.session.label})
                  </span>
                </div>
              )}
              {!latestResult && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">No results yet.</p>
              )}

              <div className="mt-4 border-t border-outline-variant pt-3">
                {summary?.hasStructure ? (
                  <div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Expected</p>
                        <p className="font-label-md text-label-md text-on-surface">{formatNaira(summary.expected)}</p>
                      </div>
                      <div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Paid</p>
                        <p className="font-label-md text-label-md text-on-surface">{formatNaira(summary.paid)}</p>
                      </div>
                      <div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Balance</p>
                        <p className="font-label-md text-label-md text-on-surface">{formatNaira(summary.balance)}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <FeeStatusBadge status={summary.status} />
                    </div>
                  </div>
                ) : (
                  <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                    No fee structure set for this term.
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
