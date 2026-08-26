import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { requireHomeworkManager } from "../auth";
import { prisma } from "@/lib/prisma";
import { HomeworkForm } from "../homework-form";

export default async function NewHomeworkPage() {
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

  const perms = await resolvePermissions(user);
  const teacherClassIds = Array.from(
    new Set(perms.assignments.filter((a) => a.classId).map((a) => a.classId as string)),
  );
  const teacherSubjectIds = Array.from(
    new Set(perms.assignments.filter((a) => a.subjectId).map((a) => a.subjectId as string)),
  );

  // Active session / term (mirrors the fees page).
  const currentSession = await prisma.session.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { name: "asc" } } },
  });
  const activeTerm =
    currentSession?.terms.find((t) => t.isCurrent) ?? currentSession?.terms[0];

  if (!activeTerm || !currentSession) {
    return (
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          New Homework
        </h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          No current session/term configured. Set up sessions and terms first.
        </p>
      </div>
    );
  }

  const classWhere = teacherClassIds.length > 0 ? { id: { in: teacherClassIds } } : {};
  const subjectWhere = teacherSubjectIds.length > 0 ? { id: { in: teacherSubjectIds } } : {};

  const [classes, subjects, terms] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, ...classWhere },
      orderBy: { name: "asc" },
      select: { id: true, name: true, level: true },
    }),
    prisma.subject.findMany({
      where: { schoolId, ...subjectWhere },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.term.findMany({
      where: { sessionId: currentSession.id },
      orderBy: [{ isCurrent: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (classes.length === 0 || subjects.length === 0) {
    return (
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          New Homework
        </h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          You are not assigned to any classes or subjects. Contact your school
          admin to set up assignments.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        New Homework
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Create a homework assignment for {activeTerm.name} term.
      </p>
      <div className="mt-6">
        <HomeworkForm
          classes={classes}
          subjects={subjects}
          terms={terms}
          activeTermId={activeTerm.id}
        />
      </div>
    </div>
  );
}
