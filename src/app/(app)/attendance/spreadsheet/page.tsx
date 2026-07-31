import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { SpreadsheetView } from "./spreadsheet-client";

export default async function AttendanceSpreadsheetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if ((!canManageSchool(perms) && !perms.isReceptionist) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [classes] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true, section: true },
    }),
  ]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Attendance Spreadsheet
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          View and export attendance records by date range.
        </p>
      </div>

      <SpreadsheetView schoolId={user.schoolId} classes={classes} today={today} isAdmin={canManageSchool(perms)} />
    </div>
  );
}
