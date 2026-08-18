import { getLeaderboard } from "@/lib/quiz/leaderboard";
import Link from "next/link";

export async function LeaderboardPeek({ schoolId }: { schoolId: string }) {
  const overall = await getLeaderboard(schoolId);
  const topOverall = overall.slice(0, 5);
  // Per-class top 3
  const classMap = new Map<string, typeof overall>();
  for (const e of overall) {
    if (!classMap.has(e.className)) classMap.set(e.className, []);
    const arr = classMap.get(e.className)!;
    if (arr.length < 3) arr.push(e);
  }

  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-label-md text-label-md text-on-surface">Quiz Leaderboard</h3>
        <Link href="/quiz" className="font-label-sm text-label-sm text-primary">View all</Link>
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Top students (overall)</p>
      <ol className="space-y-1 mb-4">
        {topOverall.map((e, i) => (
          <li key={e.studentId} className="flex items-center justify-between text-sm">
            <span>{i + 1}. {e.name} <span className="text-on-surface-variant">· {e.className}</span></span>
            <span className="font-medium">{e.points} pts</span>
          </li>
        ))}
        {topOverall.length === 0 && <li className="text-sm text-on-surface-variant">No quiz attempts yet.</li>}
      </ol>
      {Array.from(classMap.entries()).map(([className, rows]) => (
        <div key={className} className="mb-3">
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Top in {className}</p>
          <ul className="space-y-1">
            {rows.map((e) => (
              <li key={e.studentId} className="flex items-center justify-between text-sm">
                <span>{e.name}</span>
                <span className="font-medium">{e.points} pts</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
