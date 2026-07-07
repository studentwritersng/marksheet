import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { SubjectForm } from "./subject-form";
import { SubjectList } from "./subject-list";

export default async function SubjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const subjects = await prisma.subject.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Subjects</h1>
      <div className="mt-6">
        <SubjectForm />
      </div>
      <div className="mt-8">
        <SubjectList
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        />
      </div>
    </div>
  );
}
