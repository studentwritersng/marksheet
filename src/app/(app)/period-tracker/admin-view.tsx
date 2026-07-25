import { prisma } from "@/lib/prisma";
import { CollapsibleSubject } from "./collapsible-subject";

export async function AdminPeriodView({
  schoolId,
  selectedClassId,
}: {
  schoolId: string;
  selectedClassId?: string;
}) {
  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, name: true, level: true },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });

  // term.name is enum — must uppercase to match CurriculumTopic.term
  const termName = currentTerm ? (currentTerm.name as string).toUpperCase() : "";

  const filteredClasses = selectedClassId
    ? classes.filter((c) => c.id === selectedClassId)
    : classes;

  const sections = await Promise.all(
    filteredClasses.map(async (cls) => {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: cls.id },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: "asc" } },
      });

      const subjectRows = await Promise.all(
        classSubjects.map(async (cs) => {
          // School-specific first, NERDC fallback
          let total = await prisma.curriculumTopic.count({
            where: { classLevel: cls.level, subject: { equals: cs.subject.name, mode: "insensitive" }, term: termName, schoolId },
          });
          if (total === 0) {
            total = await prisma.curriculumTopic.count({
              where: { classLevel: cls.level, subject: { equals: cs.subject.name, mode: "insensitive" }, term: termName, schoolId: null },
            });
          }
          if (total === 0) return null;

          const taught = await prisma.taughtTopic.count({
            where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: true },
          });
          const teacherOnly = await prisma.taughtTopic.count({
            where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: false },
          });
          const pct = Math.round((taught / total) * 100);
          return { subjectId: cs.subjectId, subjectName: cs.subject.name, taught, total, pct, teacherOnly };
        }),
      );

      return {
        classId: cls.id,
        className: cls.name,
        rows: subjectRows.filter(Boolean) as NonNullable<(typeof subjectRows)[number]>[],
      };
    }),
  );

  const visible = sections.filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-6">
      {/* Class filter */}
      <form method="GET" className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Filter by class</label>
          <select
            name="classId"
            defaultValue={selectedClassId ?? ""}
            onChange={(e) => e.target.form?.submit()}
            className="border border-outline-variant rounded p-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {selectedClassId && (
          <a href="/period-tracker" className="font-label-sm text-label-sm text-primary hover:underline pb-2.5">
            Clear
          </a>
        )}
      </form>

      {visible.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No curriculum topics found for {selectedClassId ? "this class" : "any class"} this term.
        </p>
      ) : (
        <div className="space-y-8">
          {visible.map((s) => (
            <div key={s.classId}>
              {/* Class heading */}
              <h3 className="font-label-lg text-label-lg text-on-surface mb-2 px-1">{s.className}</h3>
              <div className="space-y-2">
                {s.rows.map((r) => {
                  const badgeColor = r.pct >= 75
                    ? "bg-green-100 text-green-700"
                    : r.pct >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700";

                  return (
                    <CollapsibleSubject
                      key={r.subjectId}
                      title={r.subjectName}
                      badge={
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeColor}`}>
                            {r.pct}% — {r.taught}/{r.total}
                          </span>
                          {r.teacherOnly > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
                              {r.teacherOnly} pending
                            </span>
                          )}
                        </div>
                      }
                      defaultOpen={false}
                    >
                      {/* Progress bar inside the collapsed section */}
                      <div className="px-4 py-3 bg-surface-container-lowest">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${r.pct}%`,
                                backgroundColor: r.pct >= 75 ? "#15803d" : r.pct >= 50 ? "#d97706" : "#dc2626",
                              }}
                            />
                          </div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                            {r.taught} of {r.total} topics covered
                          </span>
                        </div>
                        {r.teacherOnly > 0 && (
                          <p className="mt-1 font-body-sm text-body-sm text-amber-700">
                            {r.teacherOnly} topic{r.teacherOnly > 1 ? "s" : ""} taught by teacher but not yet verified by captain
                          </p>
                        )}
                      </div>
                    </CollapsibleSubject>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
