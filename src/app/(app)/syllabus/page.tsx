import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { SyllabusList } from "./syllabus-list";
import { SyllabusForm } from "./syllabus-form";

export default async function SyllabusPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const [syllabi, subjects, sessions, classes] = await Promise.all([
    prisma.syllabus.findMany({
      where: { schoolId: user.schoolId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.session.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, label: true, isCurrent: true },
      orderBy: { isCurrent: "desc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      select: { id: true, level: true, section: true, department: true },
      orderBy: [{ level: "asc" }, { section: "asc" }],
    }),
  ]);

  const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s.label]));

  const classSubjectLinks = await prisma.classSubject.findMany({
    where: { schoolId: user.schoolId },
    select: { classId: true, subjectId: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Syllabi</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Upload and manage syllabi per subject and class level</p>
        </div>
      </div>

      <SyllabusForm subjects={subjects} sessions={sessions} classes={classes} classSubjectLinks={classSubjectLinks} />
      <SyllabusList syllabi={syllabi} sessionMap={sessionMap} />
    </div>
  );
}
