import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireStudentSelf } from "../../homework/auth";
import { prisma } from "@/lib/prisma";

type AttemptStatus = "in_progress" | "submitted" | "graded";

export default async function StudentHomeworkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await requireStudentSelf();
  if (!ctx) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: ctx.studentId },
    select: { currentClassId: true },
  });
  if (!student?.currentClassId) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        You are not assigned to a class.
      </p>
    );
  }

  const homeworks = await prisma.homework.findMany({
    where: { classId: student.currentClassId, status: "published" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      class: { select: { name: true } },
      subject: { select: { name: true } },
      term: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });

  const attempts = await prisma.homeworkAttempt.findMany({
    where: { studentId: ctx.studentId },
    select: { homeworkId: true, status: true },
  });
  const statusByHomework = new Map<string, AttemptStatus>(
    attempts.map((a) => [a.homeworkId, a.status]),
  );

  function linkLabel(status: AttemptStatus | undefined): string {
    if (status === "submitted" || status === "graded") return "Submitted";
    if (status === "in_progress") return "Continue";
    return "Start";
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        My Homework
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Published homework for your class.
      </p>

      {homeworks.length === 0 ? (
        <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
          <p className="font-body-md text-body-md text-on-surface">
            No homework assigned yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Title</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Subject</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Term</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Due</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">#Q</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {homeworks.map((hw) => {
                const status = statusByHomework.get(hw.id);
                const label = linkLabel(status);
                const submitted = label === "Submitted";
                return (
                  <tr key={hw.id} className="align-top">
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">{hw.title}</td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.subject?.name}</td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.term?.name}</td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                      {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw._count.questions}</td>
                    <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{label}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/student/homework/${hw.id}`}
                        className="font-label-sm text-label-sm text-primary hover:text-primary-container"
                      >
                        {submitted ? "View" : label}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
