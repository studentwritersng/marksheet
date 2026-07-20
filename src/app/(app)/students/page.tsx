import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { CreateStudentForm } from "./create-student-form";
import { StudentCsvImport } from "./student-csv-import";
import { StudentList } from "./student-list";
import { TransferStudentForm } from "./transfer-student-form";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [students, classes, membership] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      include: { currentClass: { select: { name: true } }, guardians: { select: { fullName: true, email: true } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      select: { id: true, name: true, level: true, section: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.groupMembership.findUnique({
      where: { schoolId: user.schoolId },
      select: { groupId: true },
    }),
  ]);

  // Check if Multi-Branch addon is active for this school's group
  let canTransferFromBranch = false;
  if (membership) {
    canTransferFromBranch = await isGroupAddonActive(membership.groupId, "Multi-Branch / Group of Schools");
  }

  const csvHeaders = ["Student ID", "First Name", "Last Name", "Email", "Gender", "Status", "Class", "Guardian"];
  const csvRows = students.map((s) => [
    s.admissionNumber ?? "",
    s.firstName,
    s.lastName,
    s.email ?? "",
    s.gender ?? "",
    s.status,
    s.currentClass?.name ?? "",
    s.guardians[0]?.fullName ?? "",
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Students</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {students.filter((s) => s.status === "active").length} active student(s)
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <CreateStudentForm
          classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, section: c.section, department: c.department }))}
        />
        {canTransferFromBranch ? (
          <TransferStudentForm
            classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, section: c.section, department: c.department }))}
          />
        ) : (
          <StudentCsvImport />
        )}
      </div>

      <div className="mt-8">
        <StudentList
          csvData={{ headers: csvHeaders, rows: csvRows }}
          contentId="students-content"
          students={students.map((s) => ({
            id: s.id,
            admissionNumber: s.admissionNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
            gender: s.gender,
            status: s.status,
            className: s.currentClass?.name ?? null,
            guardianName: s.guardians[0]?.fullName ?? null,
            guardianEmail: s.guardians[0]?.email ?? null,
          }))}
        />
      </div>
    </div>
  );
}
