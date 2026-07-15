import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function MyClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (perms.subjectTeacherClassIds.size === 0 && perms.classTeacherClassIds.size === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }
  if (!user.schoolId || !user.staffId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const allClassIds = new Set([...perms.subjectTeacherClassIds, ...perms.classTeacherClassIds]);
  const classes = await prisma.class.findMany({
    where: { id: { in: [...allClassIds] }, archived: false },
    select: { id: true, name: true, level: true },
    orderBy: { name: "asc" },
  });

  const assignments = await prisma.assignment.findMany({
    where: { staffId: user.staffId, classId: { in: [...allClassIds] }, schoolId: user.schoolId },
    include: { subject: { select: { name: true } } },
  });

  const subjectsByClass = new Map<string, string[]>();
  for (const a of assignments) {
    if (!a.classId || !a.subject) continue;
    const list = subjectsByClass.get(a.classId) ?? [];
    list.push(a.subject.name);
    subjectsByClass.set(a.classId, list);
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          My Classes
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Classes you are assigned to as a subject teacher or class teacher.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const subs = subjectsByClass.get(cls.id) ?? [];
          const isClassTeacher = perms.classTeacherClassIds.has(cls.id);
          return (
            <div key={cls.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{cls.name}</h3>
                {isClassTeacher && (
                  <span className="text-[10px] bg-secondary-container text-on-secondary-container rounded-full px-2 py-0.5 font-medium">Class Teacher</span>
                )}
              </div>
              {subs.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-on-surface-variant mb-1.5">Subjects:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subs.map((s) => (
                      <span key={s} className="bg-surface-container-high text-on-surface-variant text-xs rounded px-2 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {classes.length === 0 && (
          <p className="text-on-surface-variant text-sm col-span-full py-12 text-center">No class assignments found.</p>
        )}
      </div>
    </div>
  );
}
