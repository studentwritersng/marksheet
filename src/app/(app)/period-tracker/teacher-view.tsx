import { prisma } from "@/lib/prisma";
import { getTeacherPeriodData } from "@/lib/period-tracker/actions";
import { MarkTeacherTaughtForm } from "./mark-buttons";
import { CollapsibleSubject } from "./collapsible-subject";

export async function TeacherPeriodView({ schoolId, staffId }: { schoolId: string; staffId: string }) {
  const currentSession = await prisma.session.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, label: true },
  });
  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!currentTerm) {
    return <p className="font-body-md text-body-md text-on-surface-variant">No active term set.</p>;
  }

  const subjectTeacherAssignments = await prisma.assignment.findMany({
    where: { staffId, assignmentType: "subject_teacher", classId: { not: null }, subjectId: { not: null } },
    include: {
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
  });

  if (subjectTeacherAssignments.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">You have no subject assignments.</p>;
  }

  // Deduplicate class+subject combos
  const comboMap = new Map<string, { classId: string; className: string; subjectId: string; subjectName: string }>();
  for (const a of subjectTeacherAssignments) {
    if (!a.classId || !a.subjectId || !a.class || !a.subject) continue;
    const key = `${a.classId}|${a.subjectId}`;
    if (!comboMap.has(key)) {
      comboMap.set(key, {
        classId: a.classId,
        className: a.class.name,
        subjectId: a.subject.id,
        subjectName: a.subject.name,
      });
    }
  }

  // Load all entries
  const combos = Array.from(comboMap.values());
  const sections = await Promise.all(
    combos.map(async (combo) => {
      const { entries } = await getTeacherPeriodData(schoolId, staffId, combo.classId, combo.subjectId, currentTerm.id);
      return { ...combo, entries };
    }),
  );

  const hasData = sections.some((s) => s.entries.length > 0);
  if (!hasData) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">
        No curriculum topics found for your assignments this term. Make sure subjects have been added to the syllabus.
      </p>
    );
  }

  // Group by class
  const byClass = new Map<string, { className: string; subjects: typeof sections }>();
  for (const s of sections) {
    if (s.entries.length === 0) continue;
    const existing = byClass.get(s.classId) ?? { className: s.className, subjects: [] };
    existing.subjects.push(s);
    byClass.set(s.classId, existing);
  }

  return (
    <div className="space-y-6">
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {currentSession?.label ?? "—"} &middot; {currentTerm.name} Term
        &nbsp;&mdash;&nbsp;Click a subject to expand topics
      </p>

      {Array.from(byClass.values()).map((cls) => (
        <div key={cls.className}>
          {/* Class header */}
          <h3 className="font-label-lg text-label-lg text-on-surface mb-2 px-1">{cls.className}</h3>
          <div className="space-y-2">
            {cls.subjects.map((s) => {
              const taught = s.entries.filter((e) => e.teacherMarked).length;
              const total = s.entries.length;
              const pct = total > 0 ? Math.round((taught / total) * 100) : 0;
              const badgeColor = pct >= 75 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

              return (
                <CollapsibleSubject
                  key={`${s.classId}|${s.subjectId}`}
                  title={s.subjectName}
                  badge={
                    <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${badgeColor}`}>
                      {taught}/{total} taught
                    </span>
                  }
                  defaultOpen={false}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container">
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">Week</th>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">Topic</th>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant text-center">Teacher ✓</th>
                          <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant text-center">Captain ✓</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.entries.map((e) => (
                          <tr key={e.curriculumTopicId} className="border-b border-outline-variant/50 hover:bg-surface-container-low">
                            <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                              Wk {e.week}{e.weekSuffix || ""}
                            </td>
                            <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface max-w-xs">{e.topic}</td>
                            <td className="px-4 py-2 text-center">
                              {e.teacherMarked
                                ? <span className="text-green-700 font-semibold">✓</span>
                                : <span className="text-on-surface-variant">—</span>}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {e.captainMarked
                                ? <span className="text-green-700 font-semibold">✓</span>
                                : e.teacherMarked
                                ? <span className="text-amber-600 text-xs">Pending</span>
                                : <span className="text-on-surface-variant">—</span>}
                            </td>
                            <td className="px-4 py-2">
                              <MarkTeacherTaughtForm
                                schoolId={schoolId}
                                classId={s.classId}
                                subjectId={s.subjectId}
                                curriculumTopicId={e.curriculumTopicId}
                                termId={currentTerm.id}
                                alreadyMarked={e.teacherMarked}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSubject>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
