import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getStudentFeeSummaryBatch } from "@/lib/fees/bursary";
import { RemindersManager } from "./reminders-manager";

export default async function FeeRemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const perms = await resolvePermissions(user);
  if (!canManageFees(perms) || !user.schoolId) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }
  const schoolId = user.schoolId;

  const currentSession = await prisma.session.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { name: "asc" } } },
  });

  const activeTerm =
    currentSession?.terms.find((t) => t.isCurrent) ??
    currentSession?.terms[0];

  if (!activeTerm || !currentSession) {
    return (
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Fee Reminders
        </h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          No current session/terms configured. Set up sessions and terms first.
        </p>
      </div>
    );
  }

  const config = await prisma.feeReminderConfig.findUnique({
    where: { schoolId },
    select: { weeklyEnabled: true, dayOfWeek: true },
  });

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Server-rendered preview of guardians who owe for the active term.
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentClass: { select: { name: true } },
      guardians: {
        select: { parentUserId: true, email: true, fullName: true },
      },
    },
  });
  const summaries = await getStudentFeeSummaryBatch(schoolId, activeTerm.id);
  const preview = new Map<
    string,
    {
      name?: string;
      email?: string;
      parentUserId?: string;
      wards: { name: string; className: string; balance: number }[];
    }
  >();
  for (const s of students) {
    const sum = summaries.get(s.id);
    if (!sum || !sum.hasStructure || sum.balance <= 0) continue;
    for (const g of s.guardians) {
      const key = g.parentUserId ?? g.email ?? "";
      if (!key) continue;
      if (!preview.has(key)) {
        preview.set(key, {
          name: g.fullName,
          email: g.email ?? undefined,
          parentUserId: g.parentUserId ?? undefined,
          wards: [],
        });
      }
      preview.get(key)!.wards.push({
        name: `${s.firstName} ${s.lastName}`,
        className: s.currentClass?.name ?? "",
        balance: sum.balance,
      });
    }
  }

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        Fee Reminders
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Send fee balance reminders to guardians of students who owe for{" "}
        {activeTerm.name}.
      </p>
      <div className="mt-6">
        <RemindersManager
          activeTermId={activeTerm.id}
          activeTermName={activeTerm.name}
          weeklyEnabled={config?.weeklyEnabled ?? false}
          dayOfWeek={config?.dayOfWeek ?? 1}
          classes={classes}
          preview={Array.from(preview.values())}
        />
      </div>
    </div>
  );
}
