import { getCaptainPeriodData } from "@/lib/period-tracker/actions";
import { MarkCaptainTaughtForm } from "./mark-buttons";

export async function CaptainPeriodView({ schoolId, studentId, classId }: { schoolId: string; studentId: string; classId: string }) {
  const { entries } = await getCaptainPeriodData(schoolId, studentId);

  if (entries.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">No curriculum topics found for your class this term.</p>;
  }

  const grouped = new Map<string, { subjectName: string; entries: typeof entries }>();
  for (const e of entries) {
    const g = grouped.get(e.subjectId) ?? { subjectName: e.subjectName, entries: [] };
    g.entries.push(e);
    grouped.set(e.subjectId, g);
  }

  return (
    <div className="space-y-6">
      <p className="font-label-sm text-label-sm text-on-surface-variant">Your class topics &mdash; verify what has been taught</p>
      {Array.from(grouped.values()).map((g) => (
        <div key={g.subjectName} className="border border-outline-variant rounded-xl p-4">
          <h3 className="font-label-md text-label-md text-on-surface mb-3">{g.subjectName}</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant">Week</th>
                <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant">Topic</th>
                <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant">Teacher</th>
                <th className="py-1.5 pr-3 font-label-sm text-label-sm text-on-surface-variant text-center">Marked</th>
                <th className="py-1.5 font-label-sm text-label-sm text-on-surface-variant"></th>
              </tr>
            </thead>
            <tbody>
              {g.entries.map((e) => (
                <tr key={e.curriculumTopicId} className="border-b border-outline-variant/50">
                  <td className="py-2 pr-3 font-body-sm text-body-sm text-on-surface-variant">{e.week}{e.weekSuffix}</td>
                  <td className="py-2 pr-3 font-body-sm text-body-sm text-on-surface max-w-[250px] truncate">{e.topic}</td>
                  <td className="py-2 pr-3 font-body-sm text-body-sm text-on-surface-variant">{e.teacherName}</td>
                  <td className="py-2 pr-3 text-center">
                    {e.teacherMarked ? <span className="text-green-700 font-semibold">&#10003;</span> : <span className="text-red-600">Missing</span>}
                  </td>
                  <td className="py-2">
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
                    {e.captainMarked && <span className="text-green-700 text-sm font-semibold">Verified</span>}
                    {!e.teacherMarked && <span className="text-on-surface-variant text-sm">Awaiting teacher</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
