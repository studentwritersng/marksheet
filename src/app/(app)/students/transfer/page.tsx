import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { TransferStudentForm } from "../transfer-student-form";

export default async function TransferStudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId: user.schoolId },
    select: { groupId: true },
  });

  if (!membership) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">swap_horiz</span>
          <p className="text-sm text-on-surface-variant mt-3">This school is not part of a school group. Cross-branch transfers require group membership.</p>
        </div>
      </div>
    );
  }

  const addonActive = await isGroupAddonActive(membership.groupId, "Multi-Branch / Group of Schools");
  if (!addonActive) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Multi-Branch addon is not active for your group. Contact your proprietor to activate it.
        </div>
      </div>
    );
  }

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    select: { id: true, name: true, level: true, section: true, department: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <a href="/students" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Students
        </a>
      </div>
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Transfer from Branch</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Register a student transferring from another branch in your school group.
        </p>
      </div>
      <TransferStudentForm
        classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, section: c.section, department: c.department }))}
      />
    </div>
  );
}
