import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ParentActions } from "./parent-actions";

export default async function ParentDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const guardian = await prisma.guardian.findFirst({
    where: { id, student: { schoolId: user.schoolId } },
    include: {
      student: { select: { firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true } } } },
    },
  });
  if (!guardian) notFound();

  const parentUser = guardian.parentUserId
    ? await prisma.user.findUnique({
        where: { id: guardian.parentUserId },
        select: { email: true, isActive: true },
      })
    : null;

  return (
    <div>
      <Link href="/parents" className="font-label-sm text-label-sm text-primary hover:underline">&larr; Back to Parents</Link>

      <div className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 max-w-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{guardian.fullName}</h1>
        <dl className="mt-4 space-y-2 font-body-sm text-body-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Relationship</dt>
            <dd className="text-on-surface">{guardian.relationship}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Email</dt>
            <dd className="text-on-surface">{guardian.email || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Phone</dt>
            <dd className="text-on-surface">{guardian.phone || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Student</dt>
            <dd className="text-on-surface">
              <Link href={`/students/${guardian.studentId}`} className="text-primary hover:underline">
                {guardian.student.firstName} {guardian.student.lastName} ({guardian.student.admissionNumber})
              </Link>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Class</dt>
            <dd className="text-on-surface">{guardian.student.currentClass?.name || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Login Email</dt>
            <dd className="text-on-surface">{parentUser?.email || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Account Status</dt>
            <dd className={parentUser?.isActive === false ? "text-red-600" : "text-green-700"}>
              {parentUser?.isActive === false ? "Suspended" : parentUser ? "Active" : "No account"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 border-t border-outline-variant pt-6">
        <h2 className="mb-3 font-label-md text-label-md text-on-surface">Admin Actions</h2>
        <ParentActions
          guardianId={guardian.id}
          hasUser={!!guardian.parentUserId}
          isSuspended={parentUser?.isActive === false}
        />
      </div>
    </div>
  );
}
