import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateStaffForm } from "./create-staff-form";
import { StaffRow } from "./staff-row";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const staff = await prisma.staff.findMany({
    where: { schoolId: user.schoolId },
    include: {
      assignments: {
        include: { subject: true, class: true, term: true },
        where: { sessionId: (await prisma.session.findFirst({
          where: { schoolId: user.schoolId, isCurrent: true },
          select: { id: true },
        }))?.id ?? undefined },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Staff</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Manage staff records and role assignments.
      </p>

      <div className="mt-6">
        <CreateStaffForm />
      </div>

      <div className="mt-8 space-y-2">
        {staff.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No staff yet.</p>
        )}
        {staff.map((s) => (
          <StaffRow
            key={s.id}
            staff={{
              id: s.id,
              fullName: s.fullName,
              email: s.email,
              phone: s.phone,
              assignments: s.assignments.map((a) => ({
                id: a.id,
                type: a.assignmentType,
                subject: a.subject?.name ?? null,
                class: a.class?.name ?? null,
                term: a.term?.name ?? null,
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
