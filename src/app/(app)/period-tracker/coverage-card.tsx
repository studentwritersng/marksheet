import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";

export async function SubjectCoverageCard({ schoolId }: { schoolId: string }) {
  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });
  if (!currentTerm) return null;

  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, level: true, name: true },
  });

  const rows: { className: string; subjectName: string; total: number; taught: number; percentage: number }[] = [];

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
        percentage: Math.round((taught / total) * 100),
      });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
        <h2 className="font-label-lg text-label-lg text-on-surface mb-2">Coverage Overview</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">No curriculum topics found for the current term.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
      <h2 className="font-label-lg text-label-lg text-on-surface mb-4">Coverage Overview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="py-2 pr-4 font-label-sm text-label-sm text-on-surface-variant">Class</th>
              <th className="py-2 pr-4 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
              <th className="py-2 pr-4 font-label-sm text-label-sm text-on-surface-variant text-right">Taught</th>
              <th className="py-2 pr-4 font-label-sm text-label-sm text-on-surface-variant text-right">Total</th>
              <th className="py-2 font-label-sm text-label-sm text-on-surface-variant text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-outline-variant/50 hover:bg-surface-container/50">
                <td className="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{r.className}</td>
                <td className="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{r.subjectName}</td>
                <td className="py-2 pr-4 font-body-sm text-body-sm text-right">{r.taught}</td>
                <td className="py-2 pr-4 font-body-sm text-body-sm text-right text-on-surface-variant">{r.total}</td>
                <td className="py-2 font-body-sm text-body-sm text-right font-semibold">
                  <span className={r.percentage >= 75 ? "text-green-700" : r.percentage >= 50 ? "text-amber-700" : "text-red-700"}>
                    {r.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
