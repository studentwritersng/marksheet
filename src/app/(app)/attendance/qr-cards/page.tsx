import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAddonActive } from "@/lib/addons/check";
import { QrCardsClient } from "./client";

export default async function QrCardsPage() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const schoolId = user.schoolId;
  const perms = await resolvePermissions(user);
  if (!perms.isSuperAdmin && !perms.isSchoolAdmin) redirect("/attendance");

  const addonActive = await isAddonActive(schoolId, "Daily Attendance");

  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, name: true },
    orderBy: [{ level: "asc" }, { section: "asc" }],
  });

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">QR ID Cards</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Print or download QR code ID cards for student attendance scanning
        </p>
      </div>

      {!addonActive && (
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Daily Attendance addon is not active for your school. Enable it on the{" "}
          <a href="/addons" className="underline font-semibold">Addons</a> page.
        </div>
      )}

      {addonActive && (
        <QrCardsClient schoolId={schoolId} classes={classes} />
      )}
    </section>
  );
}
