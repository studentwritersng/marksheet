import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateClassForm } from "./create-class-form";
import { ClassRow } from "./class-row";
import Link from "next/link";

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const currentSession = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    include: { _count: { select: { students: true } }, session: true },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  // Group by level for display.
  const grouped = classes.reduce<Record<string, typeof classes>>((acc, c) => {
    (acc[c.level] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Classes</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {currentSession?.label ?? "No active session"}
          </p>
        </div>
        <Link
          href="/promotion"
          className="rounded-lg border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
        >
          Promotion
        </Link>
      </div>

      <div className="mt-6">
        <CreateClassForm sessionId={currentSession?.id ?? ""} />
      </div>

      <div className="mt-8 space-y-6">
        {Object.entries(grouped).length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No classes yet.</p>
        )}
        {Object.entries(grouped)
          .sort()
          .map(([level, cls]) => (
            <div key={level}>
              <h2 className="mb-2 font-label-md text-label-md text-on-surface">
                {level}
              </h2>
              <div className="space-y-2">
                {cls.map((c) => (
                  <ClassRow
                    key={c.id}
                    classItem={{
                      id: c.id,
                      name: c.name,
                      studentCount: c._count.students,
                      hasTeacher: false,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
