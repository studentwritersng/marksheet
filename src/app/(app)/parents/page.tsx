import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function ParentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const guardians = await prisma.guardian.findMany({
    where: { student: { schoolId: user.schoolId }, parentUserId: { not: null } },
    include: {
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Parents / Guardians</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        {guardians.length} parent account(s)
      </p>

      <div className="mt-6 space-y-2">
        {guardians.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No parent accounts yet.</p>
        )}
        {guardians.map((g) => (
          <Link
            key={g.id}
            href={`/parents/${g.id}`}
            className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 hover:border-primary transition-colors"
          >
            <div>
              <p className="font-label-md text-label-md text-on-surface">{g.fullName}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {g.email ?? g.phone ?? "—"} &middot; {g.relationship} of {g.student.firstName} {g.student.lastName} ({g.student.admissionNumber})
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
