import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { PromotionForm } from "./promotion-form";

export default async function PromotionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const session = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    include: {
      students: {
        where: { status: "active" },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        orderBy: { firstName: "asc" },
      },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Promotion</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        {session?.label ?? "No active session"}
      </p>

      <div className="mt-6">
        <PromotionForm
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            sessionId: c.sessionId,
            students: c.students.map((s) => ({
              id: s.id,
              admissionNumber: s.admissionNumber,
              firstName: s.firstName,
              lastName: s.lastName,
            })),
          }))}
        />
      </div>
    </div>
  );
}
