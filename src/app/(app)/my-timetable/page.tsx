import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default async function MyTimetablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { userId: user.userId },
    select: {
      firstName: true,
      lastName: true,
      currentClassId: true,
      currentClass: { select: { name: true } },
    },
  });
  if (!student) return <p className="font-body-sm text-body-sm text-on-surface-variant">Student record not found.</p>;
  if (!student.currentClassId) return <p className="font-body-sm text-body-sm text-on-surface-variant">You have not been assigned a class yet.</p>;

  const periods = await prisma.timetablePeriod.findMany({
    where: { schoolId: user.schoolId! },
    orderBy: { startTime: "asc" },
  });

  const entries = await prisma.timetableEntry.findMany({
    where: { classId: student.currentClassId },
    include: { period: true, subject: { select: { name: true } } },
  });

  const grid = new Map<string, Map<number, string>>();
  for (const p of periods) {
    const dayMap = new Map<number, string>();
    for (let d = 0; d < 5; d++) dayMap.set(d, "—");
    grid.set(p.id, dayMap);
  }
  for (const e of entries) {
    grid.get(e.periodId)?.set(e.dayOfWeek, e.subject.name);
  }

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Timetable</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {student.firstName} {student.lastName} &middot; {student.currentClass?.name}
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Timetable has not been set up yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-surface-container-lowest border border-outline-variant rounded-lg">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase text-left">Period</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase text-left">Time</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase text-left">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-surface-container-low">
                  <td className="py-3 px-4 font-label-sm text-label-sm text-on-surface font-medium">{p.name}</td>
                  <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{p.startTime}–{p.endTime}</td>
                  {DAY_LABELS.map((_, idx) => (
                    <td key={idx} className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{grid.get(p.id)?.get(idx) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
