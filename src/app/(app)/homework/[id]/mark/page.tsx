import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireHomeworkManager } from "../../auth";
import { prisma } from "@/lib/prisma";

function studentName(firstName: string, middleName: string | null, lastName: string): string {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

export default async function HomeworkMarkDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manager = await requireHomeworkManager();
  if (!manager) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }

  const homework = await prisma.homework.findFirst({
    where: { id: params.id, schoolId: manager.schoolId },
    select: { id: true, title: true, schoolId: true },
  });
  if (!homework) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Homework not found.
      </p>
    );
  }

  const attempts = await prisma.homeworkAttempt.findMany({
    where: {
      homeworkId: params.id,
      status: { in: ["submitted", "graded"] },
    },
    include: { student: true },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Mark homework
          </h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {homework.title}
          </p>
        </div>
        <Link
          href="/homework"
          className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          Back to homework
        </Link>
      </div>

      {attempts.length === 0 ? (
        <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
          <p className="font-body-md text-body-md text-on-surface">
            No submissions yet.
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Submitted attempts will appear here for marking.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Student</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">MCQ</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Total</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">%</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Submitted</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">
                    {studentName(a.student.firstName, a.student.middleName, a.student.lastName)}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{a.status}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {Number(a.mcqScore)}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {a.totalScore != null ? Number(a.totalScore) : "—"}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {a.percentage != null ? `${Math.round(Number(a.percentage))}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/homework/${homework.id}/mark/${a.id}`}
                      className="font-label-sm text-label-sm text-primary hover:text-primary-container"
                    >
                      {a.status === "graded" ? "Review" : "Mark"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
