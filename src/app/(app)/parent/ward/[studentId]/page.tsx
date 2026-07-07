import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export default async function WardResultPage(props: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await props.params;
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  const guardian = await prisma.guardian.findFirst({
    where: { parentUserId: user.userId, studentId },
    include: {
      student: {
        include: {
          currentClass: { select: { name: true } },
          subjectResults: {
            include: { subject: { select: { name: true } }, term: { include: { session: true } } },
            orderBy: [{ term: { session: { label: "desc" } } }, { subject: { name: "asc" } }],
          },
          termResults: {
            include: { term: { include: { session: true } } },
            orderBy: { term: { session: { label: "desc" } } },
          },
        },
      },
    },
  });
  if (!guardian) notFound();

  const s = guardian.student;

  // Group subject results by term
  const byTerm = s.subjectResults.reduce<Record<string, typeof s.subjectResults>>((acc, sr) => {
    const key = `${sr.term.session.label} · ${sr.term.name} Term`;
    (acc[key] ??= []).push(sr);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-on-primary-fixed" style={{fontVariationSettings: "'FILL' 1"}}>person</span>
          </div>
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {s.firstName} {s.lastName}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {s.currentClass?.name ?? "No class"} · {s.admissionNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Term results summary */}
      {s.termResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {s.termResults.map((tr) => (
            <div key={tr.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <p className="font-label-md text-label-md text-on-surface font-semibold">{tr.term.session.label}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{tr.term.name} Term</p>
              <p className="mt-2 font-headline-md text-headline-md text-primary">
                {tr.overallAverage?.toFixed(1) ?? "—"}%
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Position: #{tr.overallPosition ?? "—"}
              </p>
              {tr.affectiveRatings && (
                <div className="mt-2 pt-2 border-t border-outline-variant">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Affective</p>
                  <pre className="text-xs text-on-surface-variant mt-1">{JSON.stringify(tr.affectiveRatings, null, 1)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Subject breakdown by term */}
      {Object.entries(byTerm).map(([termKey, results]) => (
        <div key={termKey} className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
          <div className="bg-surface-container px-5 py-3 border-b border-outline-variant">
            <h3 className="font-label-md text-label-md text-on-surface font-semibold">{termKey}</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Subject</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Score</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Grade</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {results.map((sr) => (
                <tr key={sr.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-3 px-4 font-body-md text-body-md text-on-surface">{sr.subject.name}</td>
                  <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{sr.totalScore?.toFixed(1) ?? "—"}</td>
                  <td className="py-3 px-4">
                    <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">
                      {sr.grade ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">#{sr.subjectPosition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {s.termResults.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant py-8 text-center">No results available yet.</p>
      )}
    </div>
  );
}
