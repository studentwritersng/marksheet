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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <a href="/staff" className="font-label-sm text-label-sm text-primary hover:underline">← Staff</a>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-on-surface">{staff.fullName}</h1>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
            {staff.email}
            {staff.phone ? ` · ${staff.phone}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              staff.accountStatus === "suspended"
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}>
              {staff.accountStatus === "suspended" ? "Suspended" : "Active"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              staff.user ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
            }`}>
              {staff.user ? "Has login account" : "No login account"}
            </span>
          </div>
          {staff.assignments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {[...new Set(staff.assignments.map((a) => a.assignmentType))].map((type) => (
                <span key={type} className="inline-block rounded bg-primary-container px-2 py-0.5 font-label-sm text-label-sm text-on-primary-container">
                  {type.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-label-md text-label-md text-on-surface">
          Add Assignment
        </h2>
        <AssignmentForm
          staffId={staff.id}
          classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level }))}
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
