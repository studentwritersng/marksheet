import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AssignmentForm } from "./assignment-form";
import { AssignmentList } from "./assignment-list";
import { StaffActions } from "./staff-actions";

export default async function StaffDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const staff = await prisma.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      assignments: {
        include: { subject: true, class: true, term: { include: { session: true } } },
        orderBy: { createdAt: "desc" },
      },
      user: { select: { id: true, isActive: true } },
    },
  });
  if (!staff) notFound();

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    orderBy: { name: "asc" },
  });
  // Fetch class-subject links and assignments to filter subjects per class
  const classSubjects = await prisma.classSubject.findMany({
    where: { schoolId: user.schoolId },
    include: { subject: { select: { id: true, name: true } } },
  });
  // Fetch ALL subject_teacher assignments across the school so we exclude
  // subjects already taken by ANY teacher for a given class.
  const allSchoolAssignments = await prisma.assignment.findMany({
    where: { schoolId: user.schoolId, assignmentType: "subject_teacher", subjectId: { not: null } },
    select: { subjectId: true, classId: true },
  });
  const alreadyAssigned = allSchoolAssignments
    .filter((a) => a.subjectId)
    .map((a) => ({ subjectId: a.subjectId!, classId: a.classId }));
  const sessions = await prisma.session.findMany({
    where: { schoolId: user.schoolId },
    include: { terms: true },
    orderBy: { label: "desc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{staff.fullName}</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{staff.email}</p>

      <div className="mt-8">
        <h2 className="mb-3 font-label-md text-label-md text-on-surface">
          Add Assignment
        </h2>
        <AssignmentForm
          staffId={staff.id}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          classSubjects={classSubjects.map((cs) => ({
            classId: cs.classId,
            subjectId: cs.subject.id,
            subjectName: cs.subject.name,
          }))}
          alreadyAssigned={alreadyAssigned}
          sessions={sessions.map((s) => ({
            id: s.id,
            label: s.label,
            terms: s.terms.map((t) => ({ id: t.id, name: t.name })),
          }))}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-label-md text-label-md text-on-surface">
          Current Assignments
        </h2>
        <AssignmentList
          assignments={staff.assignments.map((a) => ({
            id: a.id,
            type: a.assignmentType,
            subject: a.subject?.name ?? null,
            class: a.class?.name ?? null,
            session: a.term?.session?.label ?? null,
            term: a.term?.name ?? null,
          }))}
        />
      </div>

      <div className="mt-8 border-t border-outline-variant pt-6">
        <h2 className="mb-3 font-label-md text-label-md text-on-surface">Admin Actions</h2>
        <StaffActions
          staffId={staff.id}
          hasUser={!!staff.user}
          isSuspended={staff.accountStatus === "suspended"}
        />
      </div>
    </div>
  );
}
