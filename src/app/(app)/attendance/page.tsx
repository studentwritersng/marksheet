import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAddonActive } from "@/lib/addons/check";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const schoolId = user.schoolId;
  const addonActive = await isAddonActive(schoolId, "Daily Attendance");

  const perms = await resolvePermissions(user);
  const isAdmin = perms.isSuperAdmin || perms.isSchoolAdmin;

  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, name: true, level: true, section: true },
    orderBy: [{ level: "asc" }, { section: "asc" }],
  });

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { attendancePeriodEnabled: true },
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Daily Attendance</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          QR-based student and staff attendance tracking
        </p>
      </div>

      {!addonActive && (
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Daily Attendance addon is not active for your school. Enable it on the{" "}
          <a href="/addons" className="underline font-semibold">Addons</a> page.
        </div>
      )}

      {addonActive && (
        <AttendanceClient
          schoolId={schoolId}
          staffId={user.staffId}
          isAdmin={isAdmin}
          classes={classes}
          today={today}
          attendancePeriodEnabled={school?.attendancePeriodEnabled ?? false}
        />
      )}
    </section>
  );
}
