import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ClassSubjectsForm } from "./form";

export default async function ClassSubjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [classes, subjects, links] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.classSubject.findMany({
      where: { schoolId: user.schoolId },
      include: { class: true, subject: true },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
  ]);

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        Subject–Class Links
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Assign subjects to classes (with department category) to control which subjects appear in exams and results per class.
      </p>

      <div className="mt-6">
        <ClassSubjectsForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          links={links.map((l) => ({
            classId: l.classId, className: l.class.name,
            subjectId: l.subjectId, subjectName: l.subject.name,
            department: l.department,
          }))}
        />
      </div>
    </div>
  );
}
