import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { LessonNotesList } from "../lesson-notes-list";

export default async function MyLessonNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const isTeacher =
    perms.subjectTeacherSubjectIds.size > 0 ||
    perms.classTeacherClassIds.size > 0 ||
    perms.hodSubjectIds.size > 0;
  if ((!canManageSchool(perms) && !isTeacher) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const isAdmin = canManageSchool(perms);
  const notes = isAdmin
    ? await prisma.lessonNote.findMany({
        where: { schoolId: user.schoolId },
        include: { subject: { select: { name: true } }, class: { select: { name: true } }, term: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.lessonNote.findMany({
        where: { schoolId: user.schoolId, createdBy: user.staffId ?? "" },
        include: { subject: { select: { name: true } }, class: { select: { name: true } }, term: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });

  const notesData = notes.map((n) => ({
    id: n.id,
    topic: n.topic,
    subject: n.subject.name,
    class: n.class.name,
    term: n.term.name,
    source: n.source,
    status: n.status,
    createdAt: n.createdAt.toISOString(),
    previousKnowledge: n.previousKnowledge,
    introduction: n.introduction,
    content: n.content,
    evaluation: n.evaluation,
    summary: n.summary,
    assignment: n.assignment,
    behaviouralObjectives: n.behaviouralObjectives as string[] | null,
  }));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">My Lesson Notes</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        {isAdmin
          ? "All lesson notes in this school."
          : "Lesson notes you created. Publish drafts to make them available for question generation and essay grading."}
      </p>
      <div className="mt-6">
        <LessonNotesList notes={notesData} />
      </div>
    </div>
  );
}