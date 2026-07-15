import { prisma } from "@/lib/prisma";
import { getTeacherPeriodData } from "@/lib/period-tracker/actions";
import { MarkTeacherTaughtForm } from "./mark-buttons";

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
    include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
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
      comboMap.set(key, { classId: a.classId, className: a.class.name, subjectId: a.subject.id, subjectName: a.subject.name });
    }
  }

  // Load all combo data
  const combos = Array.from(comboMap.values());
  const sections = await Promise.all(
    combos.map(async (combo) => {
      const { entries } = await getTeacherPeriodData(schoolId, staffId, combo.classId, combo.subjectId, currentTerm.id);
      return { ...combo, entries };
    }),
  );

  const hasData = sections.some((s) => s.entries.length > 0);
  if (!hasData) {
    return <p className="font-body-md text-body-md text-on-surface-variant">No curriculum topics found for your assignments this term.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        Active: {currentSession?.label ?? "—"} &middot; {currentTerm.name} Term
      </p>
      {sections.map(
        (s) =>
          s.entries.length > 0 && (
            <div key={`${s.classId}|${s.subjectId}`} className="border border-outline-variant rounded-xl p-4">
              <h3 className="font-label-md text-label-md text-on-surface mb-3">
                {s.className} &rarr; {s.subjectName}
              </h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant">Week</th>
                    <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant">Topic</th>
                    <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant text-center">Teacher</th>
                    <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant text-center">Captain</th>
                    <th className="py-1.5 font-label-sm text-label-sm text-on-surface-variant"></th>
                  </tr>
                </thead>
                <tbody>
                  {s.entries.map((e) => (
                    <tr key={e.curriculumTopicId} className="border-b border-outline-variant/50">
                      <td className="py-2 pr-3 font-body-sm text-body-sm text-on-surface-variant">
                        {e.week}{e.weekSuffix || ""}
                      </td>
                      <td className="py-2 pr-3 font-body-sm text-body-sm text-on-surface max-w-[300px] truncate">{e.topic}</td>
                      <td className="py-2 pr-3 text-center">
                        {e.teacherMarked ? (
                          <span className="text-green-700 font-semibold">&#10003;</span>
                        ) : (
                          <span className="text-on-surface-variant">&mdash;</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {e.captainMarked ? (
                          <span className="text-green-700 font-semibold">&#10003;</span>
                        ) : e.teacherMarked ? (
                          <span className="text-amber-600 text-[10px]">Pending</span>
                        ) : (
                          <span className="text-on-surface-variant">&mdash;</span>
                        )}
                      </td>
                      <td className="py-2">
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
          ),
      )}
    </div>
  );
}
