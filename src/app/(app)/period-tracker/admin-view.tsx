import { prisma } from "@/lib/prisma";

export async function AdminPeriodView({ schoolId }: { schoolId: string }) {
  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, name: true, level: true },
  });

  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });

  const sections = await Promise.all(
    classes.map(async (cls) => {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: cls.id },
        include: { subject: { select: { id: true, name: true } } },
      });

      const subjectRows = await Promise.all(
        classSubjects.map(async (cs) => {
          const total = await prisma.curriculumTopic.count({
            where: { classLevel: cls.level, subject: cs.subject.name, term: currentTerm?.name ?? "" },
          });
          if (total === 0) return null;
          const taught = await prisma.taughtTopic.count({
            where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: true },
          });
          const teacherOnly = await prisma.taughtTopic.count({
            where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: false },
          });
          const pct = Math.round((taught / total) * 100);
          return { subjectName: cs.subject.name, taught, total, pct, teacherOnly };
        }),
      );

      return { className: cls.name, rows: subjectRows.filter(Boolean) as NonNullable<typeof subjectRows[number]>[] };
    }),
  );

  const visible = sections.filter((s) => s.rows.length > 0);
  if (visible.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No curriculum topics found for any class this term.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        Coverage per class. Green = &ge;75%, Amber = &ge;50%, Red = &lt;50%.
      </p>
      {visible.map((s) => (
        <div key={s.className} className="border border-outline-variant rounded-xl p-4">
          <h3 className="font-label-lg text-label-lg text-on-surface mb-3">{s.className}</h3>
          {s.rows.map((r) => (
            <div key={r.subjectName} className="flex items-center gap-3 py-2">
              <span className="w-32 font-body-sm text-body-sm text-on-surface truncate">{r.subjectName}</span>
              <div className="flex-1 h-4 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${r.pct}%`,
                    backgroundColor: r.pct >= 75 ? "#15803d" : r.pct >= 50 ? "#d97706" : "#dc2626",
                  }}
                />
              </div>
              <span className="w-20 font-label-sm text-label-sm text-right shrink-0">
                {r.pct}% ({r.taught}/{r.total})
              </span>
              {r.teacherOnly > 0 && (
                <span className="text-amber-600 text-[10px] shrink-0">({r.teacherOnly} pending)</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
