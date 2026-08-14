import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { StudentCsvImport } from "../student-csv-import";

export default async function ImportStudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  // Classes the admin can choose as the target class for the whole import
  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    select: { id: true, name: true, department: true },
    orderBy: [{ level: "asc" }, { name: "asc" }],
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
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Import Students (CSV)</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Bulk import students from a CSV file.
        </p>
      </div>
      <StudentCsvImport classes={classes} />
    </div>
  );
}
