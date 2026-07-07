import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AssignmentForm } from "./assignment-form";
import { AssignmentList } from "./assignment-list";

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
    },
  });
  if (!staff) notFound();

  const subjects = await prisma.subject.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { name: "asc" },
  });
  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    orderBy: { name: "asc" },
  });
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
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
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
    </div>
  );
}
