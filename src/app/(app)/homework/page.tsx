import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { requireHomeworkManager } from "./auth";
import { prisma } from "@/lib/prisma";
import { publishHomeworkAction } from "./actions";

export default async function HomeworkPage() {
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
  const schoolId = manager.schoolId;

  // Resolve the teacher's scoped class ids (subject/class teacher assignments).
  const perms = await resolvePermissions(user);
  const teacherClassIds = Array.from(
    new Set(
      perms.assignments
        .filter(
          (a) =>
            (a.type === "subject_teacher" || a.type === "class_teacher") && a.classId,
        )
        .map((a) => a.classId as string),
    ),
  );

  const homeworks = await prisma.homework.findMany({
    where:
      teacherClassIds.length > 0
        ? { schoolId, classId: { in: teacherClassIds } }
        : { schoolId },
    orderBy: { createdAt: "desc" },
    include: { questions: true, class: true, subject: true, term: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Homework
          </h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Create and publish homework for your classes.
          </p>
        </div>
        {homeworks.length > 0 && (
          <Link
            href="/homework/new"
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
          >
            New homework
          </Link>
        )}
      </div>

      {homeworks.length === 0 ? (
        <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
          <p className="font-body-md text-body-md text-on-surface">
            No homework yet.
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {teacherClassIds.length === 0
              ? "You are not assigned to any classes."
              : "Create your first homework assignment."}
          </p>
          {teacherClassIds.length > 0 && (
            <Link
              href="/homework/new"
              className="mt-4 inline-block bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
            >
              New homework
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Title</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Class</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Subject</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Term</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Status</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Due</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">#Q</th>
                <th className="px-3 py-2 font-label-md text-label-md text-on-surface">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {homeworks.map((hw) => (
                <tr key={hw.id} className="align-top">
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface">{hw.title}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.class?.name}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.subject?.name}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.term?.name}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.status}</td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">
                    {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 font-label-sm text-label-sm text-on-surface-variant">{hw.questions.length}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {hw.status !== "published" && (
                        <form
                          action={async () => {
                            "use server";
                            await publishHomeworkAction(hw.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="font-label-sm text-label-sm text-primary hover:text-primary-container"
                          >
                            Publish
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/homework/${hw.id}/mark`}
                        className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
                      >
                        Mark
                      </Link>
                    </div>
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
