import { getCaptainPeriodData } from "@/lib/period-tracker/actions";
import { MarkCaptainTaughtForm } from "./mark-buttons";
import { CollapsibleSubject } from "./collapsible-subject";

export async function CaptainPeriodView({
  schoolId,
  studentId,
  classId,
}: {
  schoolId: string;
  studentId: string;
  classId: string;
}) {
  const { entries } = await getCaptainPeriodData(schoolId, studentId);

  if (entries.length === 0) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">
        No curriculum topics found for your class this term.
      </p>
    );
  }

  // Group by subject
  const grouped = new Map<string, { subjectName: string; entries: typeof entries }>();
  for (const e of entries) {
    const g = grouped.get(e.subjectId) ?? { subjectName: e.subjectName, entries: [] };
    g.entries.push(e);
    grouped.set(e.subjectId, g);
  }

  return (
    <div className="space-y-2">
      <p className="font-label-sm text-label-sm text-on-surface-variant mb-3">
        Your class topics — click a subject to expand and verify what has been taught
      </p>
      {Array.from(grouped.values()).map((g) => {
        const verified = g.entries.filter((e) => e.captainMarked).length;
        const teacherDone = g.entries.filter((e) => e.teacherMarked).length;
        const total = g.entries.length;
        const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
        const badgeColor = pct >= 75 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-surface-variant text-on-surface-variant";
        const pendingCount = teacherDone - verified;

        return (
          <CollapsibleSubject
            key={g.subjectName}
            title={g.subjectName}
            badge={
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeColor}`}>
                  {verified}/{total} verified
                </span>
                {pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
                    {pendingCount} pending
                  </span>
                )}
              </div>
            }
            defaultOpen={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container">
                    <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">Week</th>
                    <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">Topic</th>
                    <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">Teacher</th>
                    <th className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant text-center">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.entries.map((e) => (
                    <tr key={e.curriculumTopicId} className="border-b border-outline-variant/50 hover:bg-surface-container-low">
                      <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                        Wk {e.week}{e.weekSuffix}
                      </td>
                      <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface max-w-xs">{e.topic}</td>
                      <td className="px-4 py-2 font-body-sm text-body-sm text-on-surface-variant">{e.teacherName}</td>
                      <td className="px-4 py-2 text-center">
                        {e.captainMarked
                          ? <span className="text-green-700 font-semibold text-sm">✓ Verified</span>
                          : e.teacherMarked
                          ? <span className="text-amber-600 text-xs font-medium">Awaiting you</span>
                          : <span className="text-on-surface-variant text-xs">Not taught yet</span>}
                      </td>
                      <td className="px-4 py-2">
                        {e.teacherMarked && !e.captainMarked && (
                          <MarkCaptainTaughtForm
                            schoolId={schoolId}
                            classId={classId}
                            subjectId={e.subjectId}
                            curriculumTopicId={e.curriculumTopicId}
                            teacherId={e.teacherId}
                            alreadyMarked={false}
                          />
                        )}
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
  );
}
