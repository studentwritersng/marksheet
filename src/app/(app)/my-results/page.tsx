import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export default async function MyResultsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { userId: user.userId },
    include: {
      currentClass: { select: { name: true } },
      termResults: {
        include: { term: { select: { name: true, session: { select: { label: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) return <p className="font-body-sm text-body-sm text-on-surface-variant">Student record not found.</p>;

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Results</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {student.firstName} {student.lastName} &middot; {student.currentClass?.name ?? "—"}
        </p>
      </div>

      {student.termResults.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No results published yet.</p>
      ) : (
        <div className="space-y-4">
          {student.termResults.map((tr) => (
            <div key={tr.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {tr.term.session.label} &middot; {tr.term.name} Term
                </h3>
                <span className={`font-label-sm text-label-sm px-2.5 py-0.5 rounded-full capitalize ${
                  tr.status === "finalised"
                    ? "bg-secondary-container text-on-secondary-container"
                    : tr.status === "withheld"
                      ? "bg-error-container text-on-error-container"
                      : "bg-surface-variant text-on-surface-variant"
                }`}>
                  {tr.status}
                </span>
              </div>
              {tr.status === "withheld" ? (
                <div className="bg-surface-container rounded p-3 text-center">
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Results are currently withheld. Please see the school office for more information.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-surface-container rounded p-3">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Average</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface mt-1">{tr.overallAverage?.toFixed(1) ?? "—"}</div>
                </div>
                <div className="bg-surface-container rounded p-3">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Position</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface mt-1">{tr.overallPosition ? `${tr.overallPosition}` : "—"}</div>
                </div>
                <div className="bg-surface-container rounded p-3">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Cumulative</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface mt-1">{tr.cumulativeAverage?.toFixed(1) ?? "—"}</div>
                </div>
                <div className="bg-surface-container rounded p-3">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Status</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface mt-1 capitalize">{tr.status}</div>
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
