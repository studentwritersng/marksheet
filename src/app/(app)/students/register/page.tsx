import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateStudentForm } from "../create-student-form";

export default async function RegisterStudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
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
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Register Student</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Student ID is auto-generated from school shortcode + sequence.
        </p>
      </div>
      <CreateStudentForm
        classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, section: c.section, department: c.department }))}
      />
    </div>
  );
}
