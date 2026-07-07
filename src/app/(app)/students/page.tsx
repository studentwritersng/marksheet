import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateStudentForm } from "./create-student-form";
import { StudentCsvImport } from "./student-csv-import";
import { StudentList } from "./student-list";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      include: { currentClass: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      select: { id: true, name: true, level: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Students</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        {students.filter((s) => s.status === "active").length} active student(s)
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <CreateStudentForm
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        />
        <StudentCsvImport />
      </div>

      <div className="mt-8">
        <StudentList
          students={students.map((s) => ({
            id: s.id,
            admissionNumber: s.admissionNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            gender: s.gender,
            status: s.status,
            className: s.currentClass?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
