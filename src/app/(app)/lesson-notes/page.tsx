import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { LessonNotesForm } from "./lesson-notes-form";
import { LessonNotesList } from "./lesson-notes-list";

export default async function LessonNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [subjects, classes, terms, notes] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.term.findMany({ where: { session: { schoolId: user.schoolId, isCurrent: true } }, orderBy: { name: "asc" } }),
    prisma.lessonNote.findMany({
      where: { schoolId: user.schoolId },
      include: { subject: true, class: true, term: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Lesson Notes</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        AI drafts land as <strong>draft</strong> — review and publish to make them available
        for question generation and essay grading.
      </p>

      <div className="mt-6">
        <LessonNotesForm
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          terms={terms.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>

      <div className="mt-8">
        <LessonNotesList
          notes={notes.map((n) => ({
            id: n.id,
            topic: n.topic,
            subject: n.subject.name,
            class: n.class.name,
            term: n.term.name,
            source: n.source,
            status: n.status,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}